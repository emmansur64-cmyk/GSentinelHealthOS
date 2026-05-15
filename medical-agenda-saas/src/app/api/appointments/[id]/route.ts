import { fail, ok } from "@/lib/api-response";
import { logAudit, requestMeta } from "@/lib/audit";
import { auditLog } from "@/lib/compliance/audit-log";
import { logFunctionalAudit } from "@/lib/audit-functional";
import { lockDoctorSchedule } from "@/lib/db-locks";
import { requireTenant } from "@/middleware/tenantMiddleware";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { logServerError } from "@/lib/server-logger";
import { findNextAvailableSlot } from "@/lib/smart-schedule";
import { appointmentUpdateSchema } from "@/lib/validators";
import type { Prisma } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

function isValidStatusTransition(
  current: "scheduled" | "confirmed" | "cancelled" | "completed" | "no_show",
  next: "scheduled" | "confirmed" | "cancelled" | "completed" | "no_show",
): boolean {
  const validTransitions: Record<string, Array<"scheduled" | "confirmed" | "cancelled" | "completed" | "no_show">> = {
    scheduled: ["confirmed", "cancelled", "no_show", "completed"],
    confirmed: ["completed", "cancelled", "no_show"],
    completed: [],
    cancelled: [],
    no_show: [],
  };

  return validTransitions[current]?.includes(next) ?? false;
}

const appointmentInclude = {
  patient: true,
  doctor: { include: { user: { select: { name: true } } } },
} as const;

function serializeAppointment<T extends { patient?: { phone?: string; document?: string | null } }>(appointment: T) {
  if (!appointment.patient) return appointment;

  return {
    ...appointment,
    patient: {
      ...appointment.patient,
      contact: appointment.patient.phone,
      document: appointment.patient.document ?? "",
    },
  };
}

// ── GET /api/appointments/:id ─────────────────────────────────────────────────

export async function GET(_request: Request, context: Params) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const { id } = await context.params;

  const appointment = await prisma.appointment.findFirst({
    where: { id, tenant_id: tenant.tenant.id, deleted_at: null },
    include: appointmentInclude,
  });

  if (!appointment) return fail("Turno no encontrado", 404);
  if (hasRole(authUser, ["doctor", "medico"]) && appointment.doctor_id !== authUser.userId) {
    return fail("Sin permisos", 403);
  }

  await auditLog({
    tenantId: tenant.tenant.id,
    actorUserId: authUser.userId,
    patientId: appointment.patient_id,
    entityType: "appointment",
    entityId: appointment.id,
    action: "READ",
    metadata: { endpoint: "/api/appointments/:id" },
  });

  return ok(serializeAppointment(appointment));
}

// ── PUT /api/appointments/:id ─────────────────────────────────────────────────
// Partial update: campos omitidos se mantienen intactos.
// Acepta también PATCH para compatibilidad con clientes existentes.

async function handleUpdate(request: Request, context: Params) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const { id } = await context.params;

  try {
    const parsed = appointmentUpdateSchema.safeParse(await request.json());
    const meta = requestMeta(request);
    if (!parsed.success) return fail("Payload invalido", 422, parsed.error.flatten());

    const existing = await prisma.appointment.findFirst({
      where: { id, tenant_id: tenant.tenant.id, deleted_at: null },
      select: { id: true, doctor_id: true, datetime: true, duration: true, deleted_at: true, status: true },
    });
    if (!existing || existing.deleted_at) return fail("Turno no encontrado", 404);
    if (hasRole(authUser, ["doctor", "medico"]) && existing.doctor_id !== authUser.userId) {
      return fail("Sin permisos", 403);
    }

    if (parsed.data.status && parsed.data.status !== existing.status && !isValidStatusTransition(existing.status, parsed.data.status)) {
      return fail(`Transición de estado inválida: ${existing.status} -> ${parsed.data.status}`, 409);
    }

    const targetDoctorId = parsed.data.doctor_id ?? existing.doctor_id;
    const targetDuration = parsed.data.duration ?? existing.duration;
    const requestedStart = parsed.data.datetime ? new Date(parsed.data.datetime) : existing.datetime;

    if (parsed.data.doctor_id || parsed.data.patient_id) {
      const [doctor, patient] = await Promise.all([
        parsed.data.doctor_id
          ? prisma.doctorProfile.findFirst({ where: { user_id: parsed.data.doctor_id, tenant_id: tenant.tenant.id }, select: { user_id: true } })
          : Promise.resolve({ user_id: existing.doctor_id }),
        parsed.data.patient_id
          ? prisma.patient.findFirst({ where: { id: parsed.data.patient_id, tenant_id: tenant.tenant.id }, select: { id: true } })
          : Promise.resolve({ id: null }),
      ]);
      if (!doctor) return fail("Doctor inexistente", 404);
      if (parsed.data.patient_id && !patient) return fail("Paciente inexistente", 404);
    }

    const slot = await findNextAvailableSlot(targetDoctorId, targetDuration, {
      tenantId: tenant.tenant.id,
      preferredStart: requestedStart,
      excludeAppointmentId: id,
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
      await lockDoctorSchedule(tx, targetDoctorId);

      const end = new Date(slot.start.getTime() + targetDuration * 60_000);
      const overlapping = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM appointments
        WHERE tenant_id = ${tenant.tenant.id}
          AND doctor_id = ${targetDoctorId}
          AND id <> ${id}
          AND deleted_at IS NULL
          AND status NOT IN ('cancelled', 'no_show')
          AND datetime < ${end}::timestamptz
          AND datetime + (duration || ' minutes')::interval > ${slot.start}::timestamptz
        LIMIT 1
      `;

      if (overlapping.length > 0) {
        throw new Error("OVERLAP_ON_UPDATE");
      }

      await tx.appointment.updateMany({
        where: { id, tenant_id: tenant.tenant.id },
        data: {
          patient_id: parsed.data.patient_id,
          doctor_id: targetDoctorId,
          datetime: slot.start,
          duration: targetDuration,
          status: parsed.data.status,
          source: parsed.data.source,
          notes: parsed.data.notes,
        },
      });

      const appointment = await tx.appointment.findFirst({
        where: { id, tenant_id: tenant.tenant.id },
        include: appointmentInclude,
      });
      if (!appointment) throw new Error("APPOINTMENT_NOT_FOUND_AFTER_UPDATE");
      return appointment;
    });

    await logAudit({
      userId: authUser.userId,
      role: authUser.role,
      action: "appointment.update",
      entity: "appointment",
      entityId: updated.id,
      details: {
        ...parsed.data,
        requested_datetime: requestedStart,
        assigned_datetime: slot.start,
        auto_rescheduled: autoRescheduled,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await logFunctionalAudit({
      userId: authUser.userId,
      action: "UPDATE_APPOINTMENT",
      entityType: "appointment",
      entityId: updated.id,
      payloadBefore: {
        id: existing.id,
        doctor_id: existing.doctor_id,
        datetime: existing.datetime,
        duration: existing.duration,
      },
      payloadAfter: {
        id: updated.id,
        doctor_id: updated.doctor_id,
        datetime: updated.datetime,
        duration: updated.duration,
        status: updated.status,
      },
    });

    if (autoRescheduled) {
      console.info(
        `[appointments.update] auto-rescheduled appointment=${id} requested=${requestedStart.toISOString()} assigned=${slot.start.toISOString()}`,
      );
    }

    return ok(serializeAppointment(updated));
  } catch (error) {
    if (error instanceof Error && error.message === "OVERLAP_ON_UPDATE") {
      return fail("El turno se superpone con otra reserva confirmada", 409);
    }

    logServerError("appointments.update.failed", error, {
      endpoint: "/api/appointments/:id",
      method: "PUT",
      appointment_id: id,
      user_id: authUser.userId,
    });
    return fail("No se pudo editar turno", 500, error instanceof Error ? error.message : null);
  }
}

export const PUT   = handleUpdate;
export const PATCH = handleUpdate;

// ── DELETE /api/appointments/:id ──────────────────────────────────────────────

export async function DELETE(request: Request, context: Params) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const { id } = await context.params;

  try {
    const meta = requestMeta(request);
    const existing = await prisma.appointment.findFirst({
      where: { id, tenant_id: tenant.tenant.id, deleted_at: null },
      select: {
        id: true,
        doctor_id: true,
        patient_id: true,
        datetime: true,
        duration: true,
        status: true,
        deleted_at: true,
      },
    });
    if (!existing || existing.deleted_at) return fail("Turno no encontrado", 404);
    if (hasRole(authUser, ["doctor", "medico"]) && existing.doctor_id !== authUser.userId) {
      return fail("Sin permisos", 403);
    }

    const deletedAt = new Date();

    await prisma.appointment.updateMany({
      where: { id, tenant_id: tenant.tenant.id },
      data: {
        deleted_at: deletedAt,
        status: "cancelled",
      },
    });

    await logAudit({
      userId: authUser.userId,
      role: authUser.role,
      action: "appointment.delete",
      entity: "appointment",
      entityId: id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await logFunctionalAudit({
      userId: authUser.userId,
      action: "DELETE_APPOINTMENT",
      entityType: "appointment",
      entityId: id,
      payloadBefore: existing,
      payloadAfter: {
        id,
        deleted_at: deletedAt,
        status: "cancelled",
      },
    });

    return ok({ deleted: true, soft_delete: true, deleted_at: deletedAt.toISOString() });
  } catch (error) {
    logServerError("appointments.delete.failed", error, {
      endpoint: "/api/appointments/:id",
      method: "DELETE",
      appointment_id: id,
      user_id: authUser.userId,
    });
    return fail("No se pudo eliminar turno", 500, error instanceof Error ? error.message : null);
  }
}
