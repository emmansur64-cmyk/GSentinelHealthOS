import { fail, ok } from "@/lib/api-response";
import { logAudit, requestMeta } from "@/lib/audit";
import { logFunctionalAudit } from "@/lib/audit-functional";
import { lockDoctorSchedule } from "@/lib/db-locks";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { logServerError } from "@/lib/server-logger";
import { findNextAvailableSlot } from "@/lib/smart-schedule";
import { appointmentCreateFollowupSchema } from "@/lib/validators";
import type { Prisma } from "@prisma/client";

function applyTime(baseDate: Date, hhmm?: string) {
  if (!hhmm) return baseDate;
  const [hours, minutes] = hhmm.split(":").map(Number);
  const next = new Date(baseDate);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

export async function POST(request: Request) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["doctor"])) return fail("Sin permisos", 403);

  try {
    const parsed = appointmentCreateFollowupSchema.safeParse(await request.json());
    if (!parsed.success) return fail("Payload invalido", 422, parsed.error.flatten());

    const sourceAppointment = await prisma.appointment.findFirst({
      where: { id: parsed.data.appointment_id, doctor_id: authUser.userId, deleted_at: null },
      include: { patient: true },
    });
    if (!sourceAppointment) return fail("Turno base no encontrado", 404);

    const nextDate = new Date(sourceAppointment.datetime);
    nextDate.setDate(nextDate.getDate() + parsed.data.days);
    const requestedDate = applyTime(nextDate, parsed.data.time);

    const slot = await findNextAvailableSlot(sourceAppointment.doctor_id, sourceAppointment.duration, {
      preferredStart: requestedDate,
      maxSearchDays: 90,
    });

    if (!slot) {
      return fail("No hay huecos disponibles para crear el seguimiento", 409);
    }

    const autoScheduled = slot.start.getTime() !== requestedDate.getTime();

    const followup = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await lockDoctorSchedule(tx, sourceAppointment.doctor_id);

      const end = new Date(slot.start.getTime() + sourceAppointment.duration * 60_000);
      const overlapping = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM appointments
        WHERE doctor_id = ${sourceAppointment.doctor_id}::uuid
          AND deleted_at IS NULL
          AND status NOT IN ('cancelled', 'no_show')
          AND datetime < ${end}::timestamptz
          AND datetime + (duration || ' minutes')::interval > ${slot.start}::timestamptz
        LIMIT 1
      `;

      if (overlapping.length > 0) {
        throw new Error("OVERLAP_ON_FOLLOWUP");
      }

      return tx.appointment.create({
        data: {
          patient_id: sourceAppointment.patient_id,
          doctor_id: sourceAppointment.doctor_id,
          datetime: slot.start,
          duration: sourceAppointment.duration,
          status: "scheduled",
          source: parsed.data.source,
          notes:
            `Seguimiento generado desde turno ${sourceAppointment.id} (${parsed.data.days} dias).` +
            (parsed.data.notes ? ` ${parsed.data.notes}` : ""),
        },
        include: {
          patient: true,
          doctor: { include: { user: { select: { name: true } } } },
        },
      });
    });

    const meta = requestMeta(request);
    await logAudit({
      userId: authUser.userId,
      role: authUser.role,
      action: "doctor.appointment.create_followup",
      entity: "appointment",
      entityId: followup.id,
      details: {
        from_appointment_id: sourceAppointment.id,
        patient_id: followup.patient_id,
        datetime: followup.datetime,
        requested_datetime: requestedDate,
        auto_scheduled: autoScheduled,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await logFunctionalAudit({
      userId: authUser.userId,
      action: "CREATE_FOLLOWUP",
      entityType: "appointment",
      entityId: followup.id,
      payloadBefore: {
        id: sourceAppointment.id,
        datetime: sourceAppointment.datetime,
        duration: sourceAppointment.duration,
      },
      payloadAfter: {
        id: followup.id,
        datetime: followup.datetime,
        duration: followup.duration,
        source: followup.source,
      },
    });

    if (autoScheduled) {
      console.info(
        `[appointments.create-followup] auto-scheduled from=${sourceAppointment.id} requested=${requestedDate.toISOString()} assigned=${followup.datetime.toISOString()}`,
      );
    }

    return ok(followup, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "OVERLAP_ON_FOLLOWUP") {
      return fail("El seguimiento se superpone con otra reserva confirmada", 409);
    }

    logServerError("appointments.create-followup.failed", error, {
      endpoint: "/api/appointments/create-followup",
      method: "POST",
      user_id: authUser.userId,
    });
    return fail("No se pudo crear seguimiento", 500, error instanceof Error ? error.message : null);
  }
}