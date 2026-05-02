import { prisma } from "@/lib/prisma";

export async function SystemNotificationBanner({ tenantId }: { tenantId: string }) {
  const [tenantRows, notifications] = await Promise.all([
    prisma.$queryRaw<Array<{ maintenance_mode: boolean; status: string }>>`
      SELECT maintenance_mode, estado::text AS status FROM tenants WHERE id = ${tenantId} LIMIT 1
    `,
    prisma.$queryRaw<Array<{ id: string; title: string; message: string; type: string }>>`
      SELECT id, title, message, type
      FROM system_notifications
      WHERE status = 'sent' AND (clinic_id = ${tenantId} OR clinic_id IS NULL)
      ORDER BY created_at DESC
      LIMIT 3
    `,
  ]);

  const tenant = tenantRows[0];
  const blockedMessage =
    tenant?.status === "suspended"
      ? "Tu cuenta se encuentra suspendida. Contacta al administrador."
      : tenant?.maintenance_mode
        ? "El sistema se encuentra en mantenimiento programado. Algunas funciones pueden estar temporalmente limitadas."
        : null;

  if (!blockedMessage && notifications.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {blockedMessage ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {blockedMessage}
        </div>
      ) : null}
      {notifications.map((item) => (
        <div key={item.id} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          <p className="font-semibold text-slate-950">{item.title}</p>
          <p>{item.message}</p>
        </div>
      ))}
    </div>
  );
}
