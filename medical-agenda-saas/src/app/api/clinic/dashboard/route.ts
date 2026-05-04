import { ok } from "@/lib/api-response";
import { requireClinicApi, touchLastSeen } from "@/lib/clinic-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const ctx = await requireClinicApi();
  if (!ctx.ok) return ctx.response;
  await touchLastSeen(ctx.auth);

  const clinicId = ctx.clinic.id;
  const [summary] = await prisma.$queryRaw<Array<{
    clinic_id: string;
    clinic_name: string;
    whatsapp_status: string;
    appointments_today: number;
    upcoming_appointments: number;
    recent_patients: number;
  }>>`
    SELECT
      t.id AS clinic_id,
      t.nombre AS clinic_name,
      (SELECT COALESCE(MAX(cwa.status::text), 'pending') FROM clinic_whatsapp_accounts cwa WHERE cwa.tenant_id = t.id AND cwa.is_active = true) AS whatsapp_status,
      (SELECT COUNT(*)::int FROM appointments a WHERE a.tenant_id = t.id AND DATE(a.datetime) = CURRENT_DATE AND a.deleted_at IS NULL) AS appointments_today,
      (SELECT COUNT(*)::int FROM appointments a WHERE a.tenant_id = t.id AND a.datetime >= NOW() AND a.deleted_at IS NULL) AS upcoming_appointments,
      (SELECT COUNT(*)::int FROM patients p WHERE p.tenant_id = t.id AND p.created_at >= NOW() - INTERVAL '30 days') AS recent_patients
    FROM tenants t
    WHERE t.id = ${clinicId}
    GROUP BY t.id, t.nombre
  `;

  return ok(summary);
}
