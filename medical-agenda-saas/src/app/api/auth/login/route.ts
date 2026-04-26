import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { Prisma, Role } from "@prisma/client";

import { createSessionToken, verifyPassword } from "@/lib/auth";
import { fail, ok } from "@/lib/api-response";
import { logAudit, requestMeta } from "@/lib/audit";
import { publishMetaBrainSignal } from "@/lib/metabrain-bridge";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isTenantLegacyFallbackStrict } from "@/lib/tenant-legacy-policy";
import { loginSchema } from "@/lib/validators";

type LoginResolvedUser = {
  id: string;
  role: Role;
  name: string;
  email: string;
  passwordHash: string;
};

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID?.trim() || "default";

function isMissingTenantRelationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("42p01") ||
    message.includes("42p07") ||
    message.includes("relation \"tenants\"") ||
    message.includes("relación «tenants»")
  );
}

function isMissingTenantColumnError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("42703") ||
    message.includes("tenant_id")
  );
}

function isMissingUsernameColumnError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("42703") && message.includes("username");
}

function normalizeRole(inputRole: string): Role {
  const normalized = String(inputRole || "").toLowerCase();
  if (normalized === "admin") return "admin";
  if (normalized === "doctor") return "doctor";
  return "secretaria";
}

async function resolveTenantId(tenantRaw?: string): Promise<string> {
  const normalized = tenantRaw?.trim().toLowerCase();
  if (!normalized) return DEFAULT_TENANT_ID;

  try {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM tenants
      WHERE (id = ${normalized} OR slug = ${normalized})
        AND estado IN ('active', 'trial')
      LIMIT 1
    `;

    const tenant = rows[0] ?? null;

    if (!tenant) {
      throw new Error("TENANT_NOT_FOUND");
    }

    return tenant.id;
  } catch (error) {
    // Compatibilidad con DB legacy sin tabla tenants.
    if (isMissingTenantRelationError(error)) {
      if (isTenantLegacyFallbackStrict()) {
        await publishMetaBrainSignal({
          event: "tenant_schema_required",
          severity: "error",
          details: { area: "auth.login.resolveTenantId" },
        });
        throw new Error("TENANT_SCHEMA_REQUIRED");
      }

      await publishMetaBrainSignal({
        event: "tenant_legacy_fallback_used",
        severity: "warn",
        details: { area: "auth.login.resolveTenantId", tenant_id: DEFAULT_TENANT_ID },
      });
      return DEFAULT_TENANT_ID;
    }
    throw error;
  }
}

async function resolveUserForLogin(identifierRaw: string, tenantId: string): Promise<LoginResolvedUser | null> {
  const identifier = identifierRaw.trim();
  const lowerIdentifier = identifier.toLowerCase();

  // Ruta nueva (Prisma schema): users.email + users.password_hash
  try {
    const modernUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: lowerIdentifier },
          { name: identifier },
        ],
      },
      select: { id: true, role: true, email: true, name: true, password_hash: true },
    });

    if (modernUser?.password_hash) {
      return {
        id: modernUser.id,
        role: modernUser.role,
        name: modernUser.name,
        email: modernUser.email,
        passwordHash: modernUser.password_hash,
      };
    }
  } catch {
    // Si el esquema no coincide (legacy), continuar con fallback SQL.
  }

  // Ruta legacy (backend Python): users.username + users.hashed_password
  let legacyRows: Array<{
    id: string;
    username: string;
    role: string;
    hashed_password: string;
    is_active: boolean;
  }> = [];

  try {
    legacyRows = await prisma.$queryRaw<
      Array<{
        id: string;
        username: string;
        role: string;
        hashed_password: string;
        is_active: boolean;
      }>
    >(Prisma.sql`
      SELECT id::text AS id, username, role::text AS role, hashed_password, is_active
      FROM users
      WHERE username = ${identifier}
        AND tenant_id = ${tenantId}
      LIMIT 1
    `);
  } catch (error) {
    // Algunos esquemas modernos no tienen columna username (solo email/name).
    if (isMissingUsernameColumnError(error)) {
      return null;
    }

    // Compatibilidad con DB legacy sin columna tenant_id en users.
    if (!isMissingTenantColumnError(error)) {
      throw error;
    }

    if (isTenantLegacyFallbackStrict()) {
      await publishMetaBrainSignal({
        event: "tenant_schema_required",
        severity: "error",
        details: { area: "auth.login.resolveUserForLogin" },
      });
      throw new Error("TENANT_SCHEMA_REQUIRED");
    }

    await publishMetaBrainSignal({
      event: "tenant_legacy_fallback_used",
      severity: "warn",
      details: { area: "auth.login.resolveUserForLogin", reason: "missing_tenant_id_column" },
    });

    try {
      legacyRows = await prisma.$queryRaw<
        Array<{
          id: string;
          username: string;
          role: string;
          hashed_password: string;
          is_active: boolean;
        }>
      >(Prisma.sql`
        SELECT id::text AS id, username, role::text AS role, hashed_password, is_active
        FROM users
        WHERE username = ${identifier}
        LIMIT 1
      `);
    } catch (fallbackError) {
      if (isMissingUsernameColumnError(fallbackError)) {
        return null;
      }
      throw fallbackError;
    }
  }

  const legacyUser = legacyRows[0];
  if (!legacyUser || !legacyUser.is_active || !legacyUser.hashed_password) {
    return null;
  }

  return {
    id: legacyUser.id,
    role: normalizeRole(legacyUser.role),
    name: legacyUser.username,
    email: `${legacyUser.username}@local`,
    passwordHash: legacyUser.hashed_password,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return fail("Payload invalido", 422, parsed.error.flatten());
    }

    const meta = requestMeta(request);
    const rateLimitKey = `auth:login:${meta.ipAddress ?? "unknown"}:${parsed.data.identifier}`;
    const rateLimit = consumeRateLimit({
      key: rateLimitKey,
      limit: 8,
      windowMs: 60_000,
    });

    if (!rateLimit.allowed) {
      return fail("Demasiados intentos de login. Intenta nuevamente en unos segundos.", 429, {
        retry_after_seconds: rateLimit.retryAfterSeconds,
      });
    }

    const tenantId = await resolveTenantId(parsed.data.tenant);
    const user = await resolveUserForLogin(parsed.data.identifier, tenantId);

    if (!user) return fail("Usuario no encontrado", 404);

    const validPassword = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!validPassword) return fail("Credenciales invalidas", 401);

    const { token } = await createSessionToken({ userId: user.id, role: user.role, tenantId });

    const cookieStore = await cookies();
    cookieStore.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    cookieStore.set("tenant_id", tenantId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    await logAudit({
      userId: user.id,
      role: user.role,
      action: "auth.login",
      entity: "session",
      entityId: user.id,
      details: { identifier: parsed.data.identifier, email: user.email },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return ok({ id: user.id, name: user.name, email: user.email, role: user.role, tenant_id: tenantId });
  } catch (error) {
    if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
      return fail("Tenant inexistente o inactivo", 404);
    }

    if (error instanceof Error && error.message === "TENANT_SCHEMA_REQUIRED") {
      return fail("Esquema multi-tenant requerido. Ejecuta migraciones antes de autenticar.", 503, {
        tenant_legacy_fallback_mode: "strict",
      });
    }

    return fail("No se pudo iniciar sesion", 500, error instanceof Error ? error.message : null);
  }
}