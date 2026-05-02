import { fail, ok } from "@/lib/api-response";
import { logAudit, requestMeta } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { appointmentTodayQuerySchema } from "@/lib/validators";
import { requireTenant } from "@/middleware/tenantMiddleware";

export async function GET(request: Request) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["doctor"])) return fail("Sin permisos", 403);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const parsed = appointmentTodayQuerySchema.safeParse({
    patient_id: new URL(request.url).searchParams.get("patient_id") ?? undefined,
  });
  if (!parsed.success) return fail("Query invalida", 422, parsed.error.flatten());

  const appointments = await prisma.appointment.findMany({
    where: {
      doctor_id: authUser.userId,
      tenant_id: tenant.tenant.id,
      deleted_at: null,
      datetime: { gte: startOfDay, lte: endOfDay },
    },
    include: {
      patient: true,
      doctor: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
    orderBy: { datetime: "asc" },
  });

  let patientContext: null | {
    patient: { id: string; name: string; phone: string; notes: string | null };
    history: Array<{
      id: string;
      datetime: Date;
      status: string;
      notes: string | null;
      doctor_name: string;
    }>;
  } = null;

  if (parsed.data.patient_id) {
    const patient = await prisma.patient.findFirst({
      where: { id: parsed.data.patient_id, tenant_id: tenant.tenant.id },
      select: { id: true, name: true, phone: true, notes: true },
    });

    if (patient) {
      const historyRows = await prisma.appointment.findMany({
        where: { patient_id: patient.id, tenant_id: tenant.tenant.id, deleted_at: null },
        include: { doctor: { include: { user: { select: { name: true } } } } },
        orderBy: { datetime: "desc" },
        take: 20,
      });

      patientContext = {
        patient,
        history: historyRows.map((row) => ({
          id: row.id,
          datetime: row.datetime,
          status: row.status,
          notes: row.notes,
          doctor_name: row.doctor.user.name,
        })),
      };
    }
  }

  const meta = requestMeta(request);
  await logAudit({
    userId: authUser.userId,
    role: authUser.role,
    action: "doctor.today.read",
    entity: "appointment",
    details: { total_today: appointments.length },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return ok({
    date: startOfDay.toISOString().slice(0, 10),
    doctor_id: authUser.userId,
    appointments,
    patient_context: patientContext,
  });
}
