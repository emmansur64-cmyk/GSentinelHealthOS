import { AppointmentStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { fail, ok } from "@/lib/api-response";
import { logAudit, requestMeta } from "@/lib/audit";
import { logFunctionalAudit } from "@/lib/audit-functional";
import { lockDoctorSchedule } from "@/lib/db-locks";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { logServerError } from "@/lib/server-logger";
import { findNextAvailableSlot } from "@/lib/smart-schedule";
import { appointmentUpdateStatusSchema } from "@/lib/validators";
import { requireTenant } from "@/middleware/tenantMiddleware";

function normalizeStatus(status?: string): AppointmentStatus | undefined {
  if (!status) return undefined;
  if (status === "pending") return AppointmentStatus.scheduled;

  if (status === "scheduled") return AppointmentStatus.scheduled;
  if (status === "confirmed") return AppointmentStatus.confirmed;
  if (status === "cancelled") return AppointmentStatus.cancelled;
  if (status === "completed") return AppointmentStatus.completed;
  if (status === "no_show") return AppointmentStatus.no_show;

  return undefined;
}

function isValidStatusTransition(current: AppointmentStatus, next: AppointmentStatus): boolean {
  const validTransitions: Record<AppointmentStatus, AppointmentStatus[]> = {
    scheduled: ["confirmed", "cancelled", "no_show", "completed"],
    confirmed: ["completed", "cancelled", "no_show"],
    completed: [],
    cancelled: [],
    no_show: [],
  };

  return validTransitions[current].includes(next);
}

export async function POST(request: Request) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["doctor"])) return fail("Sin permisos", 403);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  try {
    const parsed = appointmentUpdateStatusSchema.safeParse(await request.json());
    if (!parsed.success) return fail("Payload invalido", 422, parsed.error.flatten());

    const existing = await prisma.appointment.findFirst({
      where: { id: parsed.data.appointment_id, tenant_id: tenant.tenant.id, doctor_id: authUser.userId, deleted_at: null },
      select: { id: true, notes: true, datetime: true, duration: true, doctor_id: true, status: true },
    });
    if (!existing) return fail("Turno no encontrado", 404);

    const nextStatus = normalizeStatus(parsed.data.status);
    if (nextStatus && nextStatus !== existing.status && !isValidStatusTransition(existing.status, nextStatus)) {
      return fail(`Transición de estado inválida: ${existing.status} -> ${nextStatus}`, 409);
    }

    const evolutionNote = parsed.data.evolution?.trim();
    const timestamp = new Date().toISOString();
    const mergedNotes = evolutionNote
      ? `${existing.notes ? `${existing.notes}\n\n` : ""}[${timestamp}] Evolucion clinica: ${evolutionNote}`
      : undefined;

    const requestedStart = parsed.data.datetime ? new Date(parsed.data.datetime) : existing.datetime;
    const targetDuration = parsed.data.duration ?? existing.duration;

    const slot = await findNextAvailableSlot(existing.doctor_id, targetDuration, {
      tenantId: tenant.tenant.id,
      preferredStart: requestedStart,
      excludeAppointmentId: existing.id,
      maxSearchDays: 45,
    });

    if (!slot) {
      return fail("No se encontraron huecos disponibles para reprogramar", 409);
    }

    const autoRescheduled = slot.start.getTime() !== requestedStart.getTime();
    if (autoRescheduled) {
      return fail("El horario solicitado no esta disponible", 409, {
        code: "REQUESTED_SLOT_UNAVAILABLE",
        requested_datetime: requestedStart.toISOString(),
        suggested_datetime: slot.start.toISOString(),
      });
    }

    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await lockDoctorSchedule(tx, existing.doctor_id);

      const end = new Date(slot.start.getTime() + targetDuration * 60_000);
      const overlapping = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM appointments
        WHERE tenant_id = ${tenant.tenant.id}
          AND doctor_id = ${existing.doctor_id}
          AND id <> ${existing.id}
          AND deleted_at IS NULL
          AND status NOT IN ('cancelled', 'no_show')
          AND datetime < ${end}::timestamptz
          AND datetime + (duration || ' minutes')::interval > ${slot.start}::timestamptz
        LIMIT 1
      `;

      if (overlapping.length > 0) {
        throw new Error("OVERLAP_ON_STATUS_UPDATE");
      }

      await tx.appointment.updateMany({
        where: { id: parsed.data.appointment_id, tenant_id: tenant.tenant.id },
        data: {
          status: nextStatus,
          datetime: slot.start,
          duration: targetDuration,
          notes: mergedNotes,
        },
      });

      const appointment = await tx.appointment.findFirst({
        where: { id: parsed.data.appointment_id, tenant_id: tenant.tenant.id },
        include: {
          patient: true,
          doctor: { include: { user: { select: { name: true } } } },
        },
      });
      if (!appointment) throw new Error("APPOINTMENT_NOT_FOUND_AFTER_STATUS_UPDATE");
      return appointment;
    });

    const meta = requestMeta(request);
    await logAudit({
      userId: authUser.userId,
      role: authUser.role,
      action: "doctor.appointment.update_status",
      entity: "appointment",
      entityId: updated.id,
      details: {
        status: updated.status,
        datetime: updated.datetime,
        duration: updated.duration,
        requested_datetime: requestedStart,
        assigned_datetime: slot.start,
        auto_rescheduled: autoRescheduled,
        evolution_added: Boolean(evolutionNote),
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await logFunctionalAudit({
      userId: authUser.userId,
      action: "UPDATE_STATUS",
      entityType: "appointment",
      entityId: updated.id,
      payloadBefore: {
        id: existing.id,
        status: existing.status,
        datetime: existing.datetime,
        duration: existing.duration,
      },
      payloadAfter: {
        id: updated.id,
        status: updated.status,
        datetime: updated.datetime,
        duration: updated.duration,
      },
    });

    if (autoRescheduled) {
      console.info(
        `[appointments.update-status] auto-rescheduled appointment=${updated.id} requested=${requestedStart.toISOString()} assigned=${slot.start.toISOString()}`,
      );
    }

    return ok(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "OVERLAP_ON_STATUS_UPDATE") {
      return fail("El turno se superpone con otra reserva confirmada", 409);
    }

    logServerError("appointments.update-status.failed", error, {
      endpoint: "/api/appointments/update-status",
      method: "POST",
      user_id: authUser.userId,
    });
    return fail("No se pudo actualizar estado clinico", 500, error instanceof Error ? error.message : null);
  }
}
