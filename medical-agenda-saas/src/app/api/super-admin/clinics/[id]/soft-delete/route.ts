import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getRequestIp, requireSuperAdminApi, writeAdminAudit } from "@/lib/super-admin";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (body?.confirmation !== "DESACTIVAR") return fail("Confirmacion requerida", 409);

  await prisma.$executeRaw`UPDATE tenants SET estado = 'disabled'::"TenantStatus", updated_at = NOW() WHERE id = ${id}`;
  await prisma.$executeRaw`
    UPDATE users SET status = 'suspended', active = false, updated_at = NOW()
    WHERE tenant_id = ${id} AND role::text <> 'super_admin'
  `;

  await writeAdminAudit({
    actorUserId: auth.user.userId,
    action: "clinic_disabled",
    targetType: "clinic",
    targetId: id,
    clinicId: id,
    metadata: { soft_delete: true },
    ipAddress: getRequestIp(request),
  });

  return ok({ id, status: "disabled" });
}
