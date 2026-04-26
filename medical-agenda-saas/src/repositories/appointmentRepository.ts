import type { Prisma } from "@prisma/client";

import { lockDoctorSchedule } from "@/lib/db-locks";

function sanitizePhoneFromDocument(document: string): string {
  const compact = document.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
  return `pending-${compact || "patient"}`;
}

export async function upsertPatientByDocument(
  tx: Prisma.TransactionClient,
  input: { nombre: string; documento: string; telefono?: string },
): Promise<{ id: string; name: string }> {
  const syntheticPhone = sanitizePhoneFromDocument(input.documento);
  const targetPhone = input.telefono?.trim() || syntheticPhone;

  const existing = await tx.patient.findFirst({
    where: {
      OR: [
        { phone: syntheticPhone },
        ...(input.telefono ? [{ phone: input.telefono.trim() }] : []),
      ],
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (existing) {
    if (existing.name !== input.nombre) {
      await tx.patient.update({
        where: { id: existing.id },
        data: { name: input.nombre, phone: targetPhone },
      });
    }
    return existing;
  }

  const created = await tx.patient.create({
    data: {
      name: input.nombre,
      phone: targetPhone,
      notes: `Paciente creado automaticamente por auto-assign. Documento fuente: ${input.documento}. Actualizar contacto real.`,
    },
    select: {
      id: true,
      name: true,
    },
  });

  return created;
}

export async function verifySlotCoverageInRules(
  tx: Prisma.TransactionClient,
  input: {
    doctorId: string;
    slotStart: Date;
    slotEnd: Date;
    stepMinutes: number;
  },
): Promise<boolean> {
  const yyyy = input.slotStart.getUTCFullYear();
  const mm = String(input.slotStart.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(input.slotStart.getUTCDate()).padStart(2, "0");
  const dayDate = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);

  const startHHmm = `${String(input.slotStart.getHours()).padStart(2, "0")}:${String(input.slotStart.getMinutes()).padStart(2, "0")}`;
  const endHHmm = `${String(input.slotEnd.getHours()).padStart(2, "0")}:${String(input.slotEnd.getMinutes()).padStart(2, "0")}`;

  const coveringRule = await tx.availabilityRule.findFirst({
    where: {
      doctor_id: input.doctorId,
      start_time: {
        lte: startHHmm,
      },
      end_time: {
        gte: endHHmm,
      },
      slot_duration: input.stepMinutes,
      OR: [
        {
          specific_date: dayDate,
        },
        {
          specific_date: null,
          day_of_week: input.slotStart.getDay(),
        },
      ],
    },
    select: {
      id: true,
    },
  });

  return Boolean(coveringRule);
}

export async function findOverlappingAppointment(
  tx: Prisma.TransactionClient,
  input: {
    doctorId: string;
    slotStart: Date;
    slotEnd: Date;
  },
): Promise<{ id: string } | null> {
  const overlapping = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM appointments
    WHERE doctor_id = ${input.doctorId}
      AND deleted_at IS NULL
      AND status NOT IN ('cancelled', 'no_show')
      AND datetime < ${input.slotEnd}
      AND datetime + (duration || ' minutes')::interval > ${input.slotStart}
    LIMIT 1
  `;

  return overlapping[0] ?? null;
}

export async function lockDoctorForScheduling(tx: Prisma.TransactionClient, doctorId: string): Promise<void> {
  await lockDoctorSchedule(tx, doctorId);
}

export async function createAppointmentRecord(
  tx: Prisma.TransactionClient,
  input: {
    patientId: string;
    doctorId: string;
    slotStart: Date;
    duration: number;
    notes: string;
    idempotencyKey: string;
  },
) {
  return tx.appointment.create({
    data: {
      patient_id: input.patientId,
      doctor_id: input.doctorId,
      datetime: input.slotStart,
      duration: input.duration,
      status: "scheduled",
      source: "manual",
      idempotency_key: input.idempotencyKey,
      notes: input.notes,
    },
    include: {
      doctor: {
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
      patient: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
    },
  });
}
