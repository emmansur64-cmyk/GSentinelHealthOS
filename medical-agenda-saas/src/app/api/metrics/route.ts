import { NextResponse } from "next/server";

import { fail } from "@/lib/api-response";
import { requireTenant } from "@/middleware/tenantMiddleware";
import { getPrometheusContentType, getPrometheusMetrics } from "@/lib/observability/metrics";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";

export async function GET(): Promise<Response> {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["admin"])) return fail("Sin permisos", 403);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const text = await getPrometheusMetrics();
  return new NextResponse(text, {
    status: 200,
    headers: {
      "Content-Type": getPrometheusContentType(),
      "Cache-Control": "no-store",
    },
  });
}
