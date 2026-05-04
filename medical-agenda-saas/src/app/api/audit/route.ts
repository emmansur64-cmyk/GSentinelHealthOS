import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/compliance/audit-log";
import { requireTenant } from "@/middleware/tenantMiddleware";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";

export async function GET(request: Request) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["admin", "secretaria", "recepcionista"])) return fail("Sin permisos", 403);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "30")));

  const logs = await prisma.activityLog.findMany({
    where: { tenant_id: tenant.tenant.id },
    take: limit,
    orderBy: { created_at: "desc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  await auditLog({
    tenantId: tenant.tenant.id,
    actorUserId: authUser.userId,
    entityType: "activity_log",
    action: "READ",
    metadata: { limit, returned: logs.length, endpoint: "/api/audit" },
  });

  return ok(logs);
}