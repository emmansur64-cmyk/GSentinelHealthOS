import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getRequestIp, requireSuperAdminApi, writeAdminAudit } from "@/lib/super-admin";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = String(body?.status ?? "");
  if (!["active", "suspended", "disabled"].includes(status)) return fail("Estado invalido", 422);

  const rows = await prisma.$queryRaw<Array<{ tenant_id: string; role: string }>>`
    SELECT tenant_id, role::text AS role FROM users WHERE id = ${id} LIMIT 1
  `;
  const user = rows[0];
  if (!user) return fail("Usuario no encontrado", 404);
  if (user.role === "super_admin") return fail("No se puede suspender otro super admin desde esta ruta", 409);

  await prisma.$executeRaw`
    UPDATE users
    SET status = ${status}, active = ${status === "active"}, updated_at = NOW()
    WHERE id = ${id}
  `;

  await writeAdminAudit({
    actorUserId: auth.user.userId,
    action: status === "active" ? "user_reactivated" : "user_suspended",
    targetType: "user",
    targetId: id,
    clinicId: user.tenant_id,
    metadata: { status },
    ipAddress: getRequestIp(request),
  });

  return ok({ id, status });
}
