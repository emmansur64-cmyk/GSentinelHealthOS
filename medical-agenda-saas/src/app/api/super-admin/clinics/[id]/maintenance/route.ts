import { NextRequest } from "next/server";

import { ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getRequestIp, requireSuperAdminApi, writeAdminAudit } from "@/lib/super-admin";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const enabled = Boolean(body?.maintenance_mode);

  await prisma.$executeRaw`
    UPDATE tenants SET maintenance_mode = ${enabled}, updated_at = NOW()
    WHERE id = ${id}
  `;

  await writeAdminAudit({
    actorUserId: auth.user.userId,
    action: enabled ? "maintenance_enabled" : "maintenance_disabled",
    targetType: "clinic",
    targetId: id,
    clinicId: id,
    metadata: { maintenance_mode: enabled },
    ipAddress: getRequestIp(request),
  });

  return ok({ id, maintenance_mode: enabled });
}
