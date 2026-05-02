import { fail, ok } from "@/lib/api-response";
import { requireTenant } from "@/middleware/tenantMiddleware";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { getRecommendations } from "@/services/recommendationEngine";

export async function GET(request: Request) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["admin", "secretaria", "recepcionista", "doctor", "medico"])) return fail("Sin permisos", 403);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const url = new URL(request.url);
  const specialty = url.searchParams.get("specialty")?.trim() || undefined;
  const limitRaw = url.searchParams.get("limit");
  const horizonRaw = url.searchParams.get("horizon_days");

  const limit = limitRaw ? Number(limitRaw) : undefined;
  const horizonDays = horizonRaw ? Number(horizonRaw) : undefined;

  if (limit !== undefined && (!Number.isFinite(limit) || limit < 1 || limit > 30)) {
    return fail("limit invalido (1-30)", 422);
  }

  if (horizonDays !== undefined && (!Number.isFinite(horizonDays) || horizonDays < 3 || horizonDays > 45)) {
    return fail("horizon_days invalido (3-45)", 422);
  }

  try {
    const recommendations = await getRecommendations({
      tenantId: tenant.tenant.id,
      specialty,
      limit,
      horizonDays,
    });

    return ok(recommendations);
  } catch (error) {
    return fail("No se pudieron generar recomendaciones", 500, error instanceof Error ? error.message : null);
  }
}
