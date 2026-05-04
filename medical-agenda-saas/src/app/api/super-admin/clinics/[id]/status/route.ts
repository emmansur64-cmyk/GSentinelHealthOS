import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getRequestIp, requireSuperAdminApi, writeAdminAudit } from "@/lib/super-admin";

const ACTION_BY_STATUS: Record<string, string> = {
  active: "clinic_reactivated",
  suspended: "clinic_suspended",
  disabled: "clinic_disabled",
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = String(body?.status ?? "");
  if (!["active", "suspended", "pending", "disabled"].includes(status)) return fail("Estado invalido", 422);

  if (status === "disabled" && body?.confirmation !== "DESACTIVAR") {
    return fail("Confirmacion requerida", 409);
  }

  await prisma.$executeRaw`UPDATE tenants SET estado = ${status}::"TenantStatus", updated_at = NOW() WHERE id = ${id}`;

  if (status === "suspended" || status === "disabled") {
    await prisma.$executeRaw`
      UPDATE users SET status = 'suspended', active = false, updated_at = NOW()
      WHERE tenant_id = ${id} AND role::text <> 'super_admin'
    `;
  } else if (status === "active") {
    await prisma.$executeRaw`
      UPDATE users SET status = 'active', active = true, updated_at = NOW()
      WHERE tenant_id = ${id} AND role::text <> 'super_admin'
    `;
  }

  await writeAdminAudit({
    actorUserId: auth.user.userId,
    action: ACTION_BY_STATUS[status] ?? "clinic_status_changed",
    targetType: "clinic",
    targetId: id,
    clinicId: id,
    metadata: { status },
    ipAddress: getRequestIp(request),
  });

  return ok({ id, status });
}
