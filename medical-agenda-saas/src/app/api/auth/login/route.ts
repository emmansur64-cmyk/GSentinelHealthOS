import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { Prisma, Role } from "@prisma/client";

import { createSessionToken, verifyPassword } from "@/lib/auth";
import { fail, ok } from "@/lib/api-response";
import { logAudit, requestMeta } from "@/lib/audit";
import { publishMetaBrainSignal } from "@/lib/metabrain-bridge";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { pickPreferredLoginCandidate } from "@/lib/auth-login-selection";
import { isTenantLegacyFallbackStrict } from "@/lib/tenant-legacy-policy";
import { loginSchema } from "@/lib/validators";

type LoginResolvedUser = {
  id: string;
  role: Role;
  name: string;
  email: string;
  passwordHash: string;
  tenantId: string;
  active: boolean;
  status: string;
  tenantStatus: string | null;
};

type AvailableTenant = {
  id: string;
  slug: string;
  name: string;
  status: string | null;
  role: string;
};

class EmailRequiresClinicError extends Error {
  tenants: AvailableTenant[];

  constructor(tenants: AvailableTenant[]) {
    super("EMAIL_REQUIRES_CLINIC");
    this.name = "EmailRequiresClinicError";
    this.tenants = tenants;
  }
}

type UsersColumnCapabilities = {
  active: boolean;
  status: boolean;
  last_login_at: boolean;
  last_seen_at: boolean;
};

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID?.trim() || "default";
let usersColumnCapabilitiesPromise: Promise<UsersColumnCapabilities> | null = null;

function canLoginWithClinicStatus(input: {
  role: string;
  userActive: boolean;
  userStatus: string;
  tenantStatus: string | null;
}) {
  if (!input.userActive) return false;
  if (String(input.userStatus).toLowerCase() !== "active") return false;
  if (!input.tenantStatus) return true;
  const tenant = String(input.tenantStatus).toLowerCase();
  return tenant === "active" || tenant === "trial";
}

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

function isMissingModernUserColumnError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("42703") &&
    (message.includes("active") || message.includes("status") || message.includes("last_login_at"))
  );
}

function isMissingLoginAuditColumnError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("42703") &&
    (message.includes("last_login_at") || message.includes("last_seen_at"))
  );
}

function isDatabaseUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("can't reach database server") ||
    message.includes("can\u0027t reach database server") ||
    message.includes("connect econnrefused") ||
    message.includes("timeout") && message.includes("database")
  );
}

async function getUsersColumnCapabilities(): Promise<UsersColumnCapabilities> {
  if (!usersColumnCapabilitiesPromise) {
    usersColumnCapabilitiesPromise = (async () => {
      try {
        const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'users'
            AND column_name IN ('active', 'status', 'last_login_at', 'last_seen_at')
        `;

        const available = new Set(rows.map((row) => row.column_name));
        return {
          active: available.has("active"),
          status: available.has("status"),
          last_login_at: available.has("last_login_at"),
          last_seen_at: available.has("last_seen_at"),
        };
      } catch {
        // Si no se puede inspeccionar information_schema, preservamos el camino actual.
        return {
          active: true,
          status: true,
          last_login_at: true,
          last_seen_at: true,
        };
      }
    })();
  }

  return usersColumnCapabilitiesPromise;
}

async function touchUserLoginAuditColumns(userId: string): Promise<void> {
  const capabilities = await getUsersColumnCapabilities();
  const updates: Prisma.Sql[] = [];

  if (capabilities.last_login_at) {
    updates.push(Prisma.sql`last_login_at = NOW()`);
  }
  if (capabilities.last_seen_at) {
    updates.push(Prisma.sql`last_seen_at = NOW()`);
  }

  if (updates.length === 0) return;

  try {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE users
      SET ${Prisma.join(updates, ", ")}
      WHERE id = ${userId}
    `);
  } catch (error) {
    if (isMissingLoginAuditColumnError(error)) {
      usersColumnCapabilitiesPromise = null;
      return;
    }
    throw error;
  }
}

function normalizeRole(inputRole: string): Role {
  const normalized = String(inputRole || "").toLowerCase();
  if (normalized === "clinic_owner") return "clinic_owner" as Role;
  if (normalized === "clinic_admin") return "clinic_admin" as Role;
  if (normalized === "receptionist") return "receptionist" as Role;
  if (normalized === "admin") return "admin";
  if (normalized === "doctor") return "doctor";
  return "secretaria";
}

async function getAvailableTenantsForIdentifier(identifierRaw: string): Promise<AvailableTenant[]> {
  const identifier = identifierRaw.trim();
  const lowerIdentifier = identifier.toLowerCase();

  try {
    return await prisma.$queryRaw<AvailableTenant[]>(Prisma.sql`
      SELECT DISTINCT
        t.id,
        t.slug,
        t.nombre AS name,
        t.estado::text AS status,
        u.role::text AS role
      FROM users u
      INNER JOIN tenants t ON t.id = u.tenant_id
      WHERE (LOWER(u.email) = ${lowerIdentifier} OR u.name = ${identifier})
        AND u.role::text <> 'super_admin'
        AND t.estado IN ('active', 'trial')
      ORDER BY t.nombre ASC
    `);
  } catch (error) {
    if (isMissingTenantRelationError(error) || isMissingTenantColumnError(error) || isMissingUsernameColumnError(error)) {
      return [];
    }
    throw error;
  }
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

async function resolveUserForLogin(identifierRaw: string, tenantId: string | null): Promise<LoginResolvedUser | null> {
  const identifier = identifierRaw.trim();
  const lowerIdentifier = identifier.toLowerCase();
  const hasRequestedTenant = Boolean(tenantId);

  // Ruta nueva (Prisma schema): users.email + users.password_hash
  try {
    const tenantFilter = tenantId ? Prisma.sql`AND u.tenant_id = ${tenantId}` : Prisma.empty;
    const capabilities = await getUsersColumnCapabilities();
    const activeExpr = capabilities.active ? Prisma.sql`u.active` : Prisma.sql`TRUE`;
    const statusExpr = capabilities.status ? Prisma.sql`COALESCE(u.status, 'active')` : Prisma.sql`'active'`;

    const modernRows = await prisma.$queryRaw<Array<{
      id: string;
      role: string;
      email: string;
      name: string;
      password_hash: string | null;
      tenant_id: string;
      active: boolean;
      status: string | null;
      tenant_status: string | null;
    }>>(Prisma.sql`
      SELECT
        u.id,
        u.role::text AS role,
        u.email,
        u.name,
        u.password_hash,
        u.tenant_id,
        ${activeExpr} AS active,
        ${statusExpr} AS status,
        t.estado::text AS tenant_status
      FROM users u
      LEFT JOIN tenants t ON t.id = u.tenant_id
      WHERE (LOWER(u.email) = ${lowerIdentifier} OR u.name = ${identifier})
        AND u.role::text <> 'super_admin'
        ${tenantFilter}
      ORDER BY
        CASE
          WHEN ${hasRequestedTenant} = TRUE AND u.tenant_id = ${tenantId} THEN 0
          ELSE 1
        END,
        u.created_at DESC
      LIMIT 3
    `);

    if (!tenantId && modernRows.length > 1) {
      throw new EmailRequiresClinicError(await getAvailableTenantsForIdentifier(identifier));
    }

    const modernUser = pickPreferredLoginCandidate(modernRows, tenantId);

    if (modernUser?.password_hash) {
      return {
        id: modernUser.id,
        role: normalizeRole(modernUser.role),
        name: modernUser.name,
        email: modernUser.email,
        passwordHash: modernUser.password_hash,
        tenantId: modernUser.tenant_id,
        active: modernUser.active,
        status: modernUser.status ?? "active",
        tenantStatus: modernUser.tenant_status,
      };
    }
  } catch (error) {
    if (error instanceof EmailRequiresClinicError) {
      throw error;
    }

    if (isMissingModernUserColumnError(error)) {
      const tenantFilter = tenantId ? Prisma.sql`AND u.tenant_id = ${tenantId}` : Prisma.empty;

      const compatibleRows = await prisma.$queryRaw<Array<{
        id: string;
        role: string;
        email: string;
        name: string;
        password_hash: string | null;
        tenant_id: string;
        tenant_status: string | null;
      }>>(Prisma.sql`
        SELECT
          u.id,
          u.role::text AS role,
          u.email,
          u.name,
          u.password_hash,
          u.tenant_id,
          t.estado::text AS tenant_status
        FROM users u
        LEFT JOIN tenants t ON t.id = u.tenant_id
        WHERE (LOWER(u.email) = ${lowerIdentifier} OR u.name = ${identifier})
          AND u.role::text <> 'super_admin'
          ${tenantFilter}
        ORDER BY
          CASE
            WHEN ${hasRequestedTenant} = TRUE AND u.tenant_id = ${tenantId} THEN 0
            ELSE 1
          END,
          u.created_at DESC
        LIMIT 3
      `);

      if (!tenantId && compatibleRows.length > 1) {
        throw new EmailRequiresClinicError(await getAvailableTenantsForIdentifier(identifier));
      }

      const compatibleUser = pickPreferredLoginCandidate(compatibleRows, tenantId);
      if (compatibleUser?.password_hash) {
        return {
          id: compatibleUser.id,
          role: normalizeRole(compatibleUser.role),
          name: compatibleUser.name,
          email: compatibleUser.email,
          passwordHash: compatibleUser.password_hash,
          tenantId: compatibleUser.tenant_id,
          active: true,
          status: "active",
          tenantStatus: compatibleUser.tenant_status,
        };
      }
    }

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

  if (!tenantId) return null;

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
    tenantId,
    active: legacyUser.is_active,
    status: legacyUser.is_active ? "active" : "suspended",
    tenantStatus: "active",
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

    const requestedTenant = parsed.data.tenant ?? parsed.data.tenant_slug ?? parsed.data.clinic_slug;
    const tenantId = requestedTenant ? await resolveTenantId(requestedTenant) : null;
    const normalizedIdentifier = parsed.data.identifier.trim().toLowerCase();

    const user = await resolveUserForLogin(parsed.data.identifier, tenantId);

    if (!user) return fail("Usuario no encontrado", 404);
    if (String(user.role) === "super_admin") {
      return fail("El acceso super admin solo esta permitido en Panel-SuperAdmin", 403);
    }
    const canLogin = canLoginWithClinicStatus({
      role: String(user.role),
      userActive: user.active,
      userStatus: user.status,
      tenantStatus: user.tenantStatus,
    });
    if (!canLogin && (!user.active || user.status !== "active")) return fail("Usuario inactivo o suspendido", 403);
    if (!canLogin) {
      return fail("Tu cuenta se encuentra suspendida. Contacta al administrador.", 403);
    }

    const validPassword = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!validPassword) return fail("Credenciales invalidas", 401);

    const sessionTenantId = String(user.tenantId);
    const { token } = await createSessionToken({ userId: user.id, role: user.role, tenantId: sessionTenantId });

    const cookieStore = await cookies();
    cookieStore.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    cookieStore.set("tenant_id", sessionTenantId, {
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

    await touchUserLoginAuditColumns(user.id);

    return ok({ id: user.id, name: user.name, email: user.email, role: user.role, tenant_id: sessionTenantId });
  } catch (error) {
    if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
      return fail("Tenant inexistente o inactivo", 404);
    }

    if (error instanceof Error && error.message === "TENANT_SCHEMA_REQUIRED") {
      return fail("Esquema multi-tenant requerido. Ejecuta migraciones antes de autenticar.", 503, {
        tenant_legacy_fallback_mode: "strict",
      });
    }

    if (error instanceof EmailRequiresClinicError) {
      return fail("El email pertenece a mas de una clinica. Selecciona la clinica para continuar.", 409, {
        code: "EMAIL_REQUIRES_CLINIC",
        tenants: error.tenants,
      });
    }

    if (isDatabaseUnavailableError(error)) {
      return fail("Base de datos no disponible temporalmente. Intenta nuevamente en unos segundos.", 503);
    }

    return fail("No se pudo iniciar sesion", 500, error instanceof Error ? error.message : null);
  }
}
