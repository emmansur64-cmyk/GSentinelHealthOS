import { AppointmentStatus, Prisma } from "@prisma/client";

import { fail, ok } from "@/lib/api-response";
import { logAudit, requestMeta } from "@/lib/audit";
import { auditLog } from "@/lib/compliance/audit-log";
import { logFunctionalAudit } from "@/lib/audit-functional";
import { lockDoctorSchedule } from "@/lib/db-locks";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { logServerError } from "@/lib/server-logger";
import { findNextAvailableSlot } from "@/lib/smart-schedule";
import { appointmentCreateSchema } from "@/lib/validators";
import { requireTenant } from "@/middleware/tenantMiddleware";
import { BillingLimitError, assertCanCreateAppointment } from "@/services/billingService";

const appointmentInclude = {
  patient: true,
  doctor: { include: { user: { select: { name: true } } } },
} as const;

function serializeAppointment<T>(appointment: T) {
  const patient = (appointment as { patient?: { phone?: string; document?: string | null } }).patient;
  if (!patient) return appointment;

  return {
    ...appointment,
    patient: {
      ...patient,
      contact: patient.phone,
      document: patient.document ?? "",
    },
  };
}

// ── GET /api/appointments ─────────────────────────────────────────────────────
// Filtros opcionales: doctor_id, patient_id, status, start (ISO), end (ISO)

export async function GET(request: Request) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const { searchParams } = new URL(request.url);
  const doctorId  = searchParams.get("doctor_id");
  const patientId = searchParams.get("patient_id");
  const status    = searchParams.get("status") as AppointmentStatus | null;
  const start     = searchParams.get("start");
  const end       = searchParams.get("end");

  // Validar status si viene
  const validStatuses: AppointmentStatus[] = ["scheduled", "confirmed", "cancelled", "completed", "no_show"];
  if (status && !validStatuses.includes(status)) {
    return fail(`status inválido. Valores permitidos: ${validStatuses.join(", ")}`, 422);
  }

  const where: Prisma.AppointmentWhereInput = { tenant_id: tenant.tenant.id };

  if (doctorId)  where.doctor_id  = doctorId;
  if (patientId) where.patient_id = patientId;
  if (status)    where.status     = status;
  where.deleted_at = null;
  if (start || end) {
    where.datetime = {};
    if (start) where.datetime.gte = new Date(start);
    if (end)   where.datetime.lte = new Date(end);
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: appointmentInclude,
    orderBy: { datetime: "asc" },
  });

  await auditLog({
    tenantId: tenant.tenant.id,
    actorUserId: authUser.userId,
    entityType: "appointment",
    action: "READ",
    metadata: {
      endpoint: "/api/appointments",
      result_count: appointments.length,
      filters: {
        doctor_id: doctorId,
        patient_id: patientId,
        status,
      },
    },
  });

  return ok(appointments.map((appointment) => serializeAppointment(appointment)));
}

// ── POST /api/appointments ────────────────────────────────────────────────────
// Verifica FK de doctor y paciente, luego crea con overlap check en transacción.

export async function POST(request: Request) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["admin", "secretaria", "recepcionista", "doctor", "medico"])) {
    return fail("Sin permisos", 403);
  }
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  try {
    const idempotencyKey = request.headers.get("idempotency-key")?.trim() || null;
    const parsed = appointmentCreateSchema.safeParse(await request.json());
    const meta = requestMeta(request);
    if (!parsed.success) return fail("Payload invalido", 422, parsed.error.flatten());

    if (hasRole(authUser, ["doctor", "medico"]) && parsed.data.doctor_id !== authUser.userId) {
      return fail("Un medico solo puede gestionar su propia agenda", 403);
    }

    await assertCanCreateAppointment(authUser.tenantId);

    if (idempotencyKey) {
      const existingByKey = await prisma.appointment.findUnique({
        where: { tenant_id_idempotency_key: { tenant_id: tenant.tenant.id, idempotency_key: idempotencyKey } },
        include: appointmentInclude,
      });

      if (existingByKey && !existingByKey.deleted_at) {
        return ok(serializeAppointment(existingByKey));
      }
    }

    // Validaciones FK fuera de la transacción (lectura rápida)
    const [doctor, patient] = await Promise.all([
      prisma.doctorProfile.findFirst({ where: { tenant_id: tenant.tenant.id, user_id: parsed.data.doctor_id }, select: { user_id: true } }),
      prisma.patient.findFirst({ where: { tenant_id: tenant.tenant.id, id: parsed.data.patient_id }, select: { id: true } }),
    ]);
    if (!doctor)  return fail("Doctor inexistente", 404);
    if (!patient) return fail("Paciente inexistente", 404);

    const requestedStart = new Date(parsed.data.datetime);
    const doctorId = parsed.data.doctor_id;

    let created: Awaited<ReturnType<typeof prisma.appointment.create>> | null = null;
    let chosenStart: Date | null = null;

    // Un turno manual no debe moverse silenciosamente a otro horario.
    for (let attempt = 0; attempt < 1; attempt += 1) {
      const preferredStart =
        attempt === 0 || !chosenStart
          ? requestedStart
          : new Date(chosenStart.getTime() + Math.max(5, parsed.data.duration) * 60_000);

      const slot = await findNextAvailableSlot(doctorId, parsed.data.duration, {
        tenantId: tenant.tenant.id,
        preferredStart,
        maxSearchDays: 45,
        allowPreferredFallbackWhenNoRules: true,
      });

      if (!slot) {
        return fail("No se encontraron huecos disponibles para ese doctor", 409, {
          code: "NO_AVAILABLE_SLOT",
          doctor_id: doctorId,
          requested_datetime: requestedStart.toISOString(),
          duration: parsed.data.duration,
        });
      }

      const candidateStart = slot.start;
      chosenStart = candidateStart;
      const end = new Date(candidateStart.getTime() + parsed.data.duration * 60_000);

      if (candidateStart.getTime() !== requestedStart.getTime()) {
        return fail("El horario solicitado no esta disponible", 409, {
          code: "REQUESTED_SLOT_UNAVAILABLE",
          doctor_id: doctorId,
          requested_datetime: requestedStart.toISOString(),
          suggested_datetime: candidateStart.toISOString(),
        });
      }

      try {
        created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          await lockDoctorSchedule(tx, doctorId);

          const overlapping = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM appointments
            WHERE tenant_id = ${tenant.tenant.id}
              AND doctor_id  = ${doctorId}
              AND deleted_at IS NULL
              AND status NOT IN ('cancelled', 'no_show')
              AND datetime < ${end}::timestamptz
              AND datetime + (duration || ' minutes')::interval > ${candidateStart}::timestamptz
            LIMIT 1
          `;

          if (overlapping.length > 0) throw new Error("OVERLAP_CONFLICT");

          return tx.appointment.create({
            data: {
              tenant_id: tenant.tenant.id,
              patient_id: parsed.data.patient_id,
              doctor_id:  doctorId,
              datetime:   candidateStart,
              duration:   parsed.data.duration,
              status:     parsed.data.status,
              source:     parsed.data.source,
              idempotency_key: idempotencyKey,
              notes:      parsed.data.notes,
            },
            include: appointmentInclude,
          });
        });

        break;
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "OVERLAP_CONFLICT") {
          throw error;
        }
      }
    }

    if (!created || !chosenStart) {
      return fail("No se pudo reservar un horario sin superposición", 409, {
        code: "OVERLAP_CONFLICT",
        doctor_id: doctorId,
        requested_datetime: requestedStart.toISOString(),
        duration: parsed.data.duration,
      });
    }

    const autoScheduled = chosenStart.getTime() !== requestedStart.getTime();

    await logAudit({
      userId: authUser.userId,
      role: authUser.role,
      action: "appointment.create",
      entity: "appointment",
      entityId: created.id,
      details: {
        doctor_id:  created.doctor_id,
        patient_id: created.patient_id,
        datetime:   created.datetime,
        status:     created.status,
        requested_datetime: requestedStart,
        auto_scheduled: autoScheduled,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await logFunctionalAudit({
      userId: authUser.userId,
      action: "CREATE_APPOINTMENT",
      entityType: "appointment",
      entityId: created.id,
      payloadAfter: {
        id: created.id,
        patient_id: created.patient_id,
        doctor_id: created.doctor_id,
        datetime: created.datetime,
        duration: created.duration,
        status: created.status,
        source: created.source,
        idempotency_key: created.idempotency_key,
      },
    });

    if (autoScheduled) {
      console.info(
        `[appointments.create] auto-scheduled doctor=${doctorId} requested=${requestedStart.toISOString()} assigned=${created.datetime.toISOString()}`,
      );
    }

    return ok(serializeAppointment(created), 201);
  } catch (error) {
    if (error instanceof BillingLimitError) {
      return fail("Limite de plan alcanzado", 402, {
        code: error.code,
        message: error.message,
      });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const key = request.headers.get("idempotency-key")?.trim() || null;
      if (key) {
        const existingByKey = await prisma.appointment.findUnique({
          where: { tenant_id_idempotency_key: { tenant_id: tenant.tenant.id, idempotency_key: key } },
          include: appointmentInclude,
        });
        if (existingByKey && !existingByKey.deleted_at) {
          return ok(serializeAppointment(existingByKey));
        }
      }
      return fail("Conflicto de idempotencia en creación de turno", 409, {
        code: "IDEMPOTENCY_CONFLICT",
      });
    }

    logServerError("appointments.create.failed", error, {
      endpoint: "/api/appointments",
      method: "POST",
      user_id: authUser.userId,
    });
    return fail("No se pudo crear turno", 500, error instanceof Error ? error.message : null);
  }
}
