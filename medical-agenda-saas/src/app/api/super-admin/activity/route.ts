import { ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminApi, writeAdminAudit } from "@/lib/super-admin";

export async function GET() {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;

  const rows = await prisma.$queryRaw`
    SELECT al.id, al.tenant_id AS clinic_id, t.nombre AS clinic_name, al.user_id, u.name AS user_name,
           al.role::text AS role, al.action, al.entity, al.entity_id, al.ip_address, al.created_at
    FROM activity_logs al
    LEFT JOIN tenants t ON t.id = al.tenant_id
    LEFT JOIN users u ON u.id = al.user_id
    ORDER BY al.created_at DESC
    LIMIT 200
  `;

  await writeAdminAudit({
    actorUserId: auth.user.userId,
    action: "super_admin.activity.read",
    targetType: "activity_logs",
    metadata: { limit: 200 },
  });

  return ok(rows);
}
