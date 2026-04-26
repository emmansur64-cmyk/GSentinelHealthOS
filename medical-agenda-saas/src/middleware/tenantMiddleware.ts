import { fail } from "@/lib/api-response";
import { publishMetaBrainSignal } from "@/lib/metabrain-bridge";
import { prisma } from "@/lib/prisma";
import type { AuthenticatedUser } from "@/lib/server-auth";
import { isTenantLegacyFallbackStrict } from "@/lib/tenant-legacy-policy";

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID?.trim() || "default";

function isMissingTenantRelationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("42p01") || message.includes("relation \"tenants\"") || message.includes("relación «tenants»");
}

export async function requireTenant(user: AuthenticatedUser) {
  const tenantId = user.tenantId || DEFAULT_TENANT_ID;

  let rows: Array<{ id: string; estado: string; plan: string; nombre: string }> = [];

  try {
    rows = await prisma.$queryRaw<Array<{ id: string; estado: string; plan: string; nombre: string }>>`
      SELECT id, estado::text AS estado, plan::text AS plan, nombre
      FROM tenants
      WHERE id = ${tenantId}
      LIMIT 1
    `;
  } catch (error) {
    // Compatibilidad con DB legacy sin tabla tenants.
    if (isMissingTenantRelationError(error)) {
      if (isTenantLegacyFallbackStrict()) {
        await publishMetaBrainSignal({
          event: "tenant_schema_required",
          severity: "error",
          details: { area: "middleware.requireTenant" },
        });
        return {
          ok: false as const,
          response: fail("Esquema multi-tenant requerido. Ejecuta migraciones antes de continuar.", 503, {
            tenant_legacy_fallback_mode: "strict",
          }),
        };
      }

      await publishMetaBrainSignal({
        event: "tenant_legacy_fallback_used",
        severity: "warn",
        details: { area: "middleware.requireTenant", tenant_id: tenantId },
      });

      return {
        ok: true as const,
        tenant: {
          id: tenantId,
          estado: "active",
          plan: "profesional",
          nombre: "Legacy Single Tenant",
        },
      };
    }
    throw error;
  }

  const tenant = rows[0] ?? null;

  if (!tenant) {
    return { ok: false as const, response: fail("Tenant no encontrado", 404) };
  }

  if (tenant.estado !== "active" && tenant.estado !== "trial") {
    return { ok: false as const, response: fail("Tenant suspendido", 403) };
  }

  return { ok: true as const, tenant };
}
