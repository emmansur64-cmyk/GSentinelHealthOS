import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getRequestIp, requireSuperAdminApi, writeAdminAudit } from "@/lib/super-admin";

export async function GET() {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;

  const rows = await prisma.$queryRaw`
    SELECT sn.id, sn.clinic_id, t.nombre AS clinic_name, sn.title, sn.message, sn.type,
           sn.status, sn.channel, sn.created_by, sn.created_at, sn.sent_at
    FROM system_notifications sn
    LEFT JOIN tenants t ON t.id = sn.clinic_id
    ORDER BY sn.created_at DESC
    LIMIT 200
  `;
  return ok(rows);
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const title = String(body?.title ?? "").trim();
  const message = String(body?.message ?? "").trim();
  const type = String(body?.type ?? "general").trim();
  const channel = String(body?.channel ?? "panel").trim();
  const clinicId = body?.clinic_id ? String(body.clinic_id) : null;
  if (!title || !message) return fail("Titulo y mensaje requeridos", 422);
  if (!["maintenance", "update", "billing", "warning", "general"].includes(type)) return fail("Tipo invalido", 422);
  if (channel !== "panel") return fail("Solo canal panel esta habilitado inicialmente", 422);

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO system_notifications (clinic_id, title, message, type, status, channel, created_by, sent_at)
    VALUES (${clinicId}, ${title}, ${message}, ${type}, 'sent', 'panel', ${auth.user.userId}, NOW())
    RETURNING id
  `;

  await writeAdminAudit({
    actorUserId: auth.user.userId,
    action: "notification_sent",
    targetType: "system_notification",
    targetId: rows[0]?.id,
    clinicId,
    metadata: { type, channel },
    ipAddress: getRequestIp(request),
  });

  return ok({ id: rows[0]?.id }, 201);
}
