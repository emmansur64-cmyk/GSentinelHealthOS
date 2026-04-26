import type { Prisma } from "@prisma/client";
import { randomBytes } from "crypto";

import { hashPassword } from "@/lib/auth";
import { lockDoctorSchedule } from "@/lib/db-locks";
import { prisma } from "@/lib/prisma";
import { generateSlotsFromSchedule } from "@/utils/slotGenerator";
import { aiIntakeSchema, normalizeAiIntakeInput } from "@/validators/aiSchema";

const DEFAULT_APPOINTMENT_DURATION = 30;

export class AiIntakeServiceError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

function buildAiTag(matricula: string): string {
  return `auto_created_${matricula.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

function buildAutoMatricula(nombre: string): string {
  const compactName = nombre
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 8) || "doctor";
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `AUTO-${compactName.toUpperCase()}-${suffix}`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 48);
}

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function ruleKey(date: Date, startTime: string, endTime: string, slotDuration: number): string {
  return `${formatDateKey(date)}|${startTime}|${endTime}|${slotDuration}`;
}

function resolveEmailDomain(): string {
  const domain = process.env.AI_INTAKE_DOCTOR_EMAIL_DOMAIN?.trim().toLowerCase();
  if (!domain) {
    throw new AiIntakeServiceError(
      "Falta configuracion AI_INTAKE_DOCTOR_EMAIL_DOMAIN para crear medicos desde IA",
      500,
    );
  }
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    throw new AiIntakeServiceError("AI_INTAKE_DOCTOR_EMAIL_DOMAIN tiene un formato invalido", 500);
  }
  return domain;
}

function resolveDefaultDuration(): number {
  const raw = process.env.AI_INTAKE_DEFAULT_APPOINTMENT_DURATION?.trim();
  if (!raw) return DEFAULT_APPOINTMENT_DURATION;

  const duration = Number(raw);
  if (!Number.isInteger(duration) || duration < 10 || duration > 240) {
    throw new AiIntakeServiceError(
      "AI_INTAKE_DEFAULT_APPOINTMENT_DURATION debe ser entero entre 10 y 240",
      500,
    );
  }

  return duration;
}

async function createUniqueDoctorUser(
  tx: Prisma.TransactionClient,
  input: { nombre: string; matricula: string; especialidad: string },
  defaultDuration: number,
  emailDomain: string,
): Promise<{ doctorId: string; appointmentDuration: number }> {
  const baseLocalPart = `${slugify(input.nombre)}.${slugify(input.matricula)}`.replace(/\.+/g, ".").slice(0, 56) || "doctor";

  let userId = "";
  const aiTagBase = buildAiTag(input.matricula);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const suffix = attempt === 0 ? "" : `.${attempt + 1}`;
    const email = `${baseLocalPart}${suffix}@${emailDomain}`;
    const aiTag = `${aiTagBase}${suffix}`;

    const existingEmail = await tx.user.findFirst({
      where: { email },
      select: { id: true },
    });
    const existingAiTag = await tx.doctorProfile.findFirst({
      where: { ai_tag: aiTag },
      select: { user_id: true },
    });
    if (existingEmail || existingAiTag) {
      continue;
    }

    const passwordHash = await hashPassword(randomBytes(24).toString("hex"));
    const user = await tx.user.create({
      data: {
        name: input.nombre,
        email,
        role: "doctor",
        password_hash: passwordHash,
      },
      select: { id: true },
    });

    await tx.doctorProfile.create({
      data: {
        user_id: user.id,
        specialty: input.especialidad,
        matricula: input.matricula,
        ai_tag: aiTag,
      },
    });

    await tx.agendaSettings.create({
      data: {
        user_id: user.id,
        appointment_duration: defaultDuration,
        buffer_minutes: 10,
        start_time: "08:00",
        end_time: "18:00",
        working_days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
      },
    });

    userId = user.id;
    break;
  }

  if (!userId) {
    throw new AiIntakeServiceError("No fue posible generar identidad unica para el medico", 409);
  }

  return {
    doctorId: userId,
    appointmentDuration: defaultDuration,
  };
}

export type AiIntakeResult = {
  status: "success";
  doctor_id: string;
  doctors_created: number;
  slots_created: number;
  slots_skipped: number;
};

export async function processAiIntake(payload: unknown, options?: { tenantId?: string }): Promise<AiIntakeResult> {
  const parsed = aiIntakeSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AiIntakeServiceError("Payload invalido", 422, parsed.error.flatten());
  }

  const normalized = normalizeAiIntakeInput(parsed.data);
  const defaultDuration = resolveDefaultDuration();
  void options?.tenantId;

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    let doctorId = "";
    let appointmentDuration = defaultDuration;
    let doctorsCreated = 0;

    const doctorMatchers: Array<Prisma.DoctorProfileWhereInput> = [
      {
        user: {
          is: {
            name: {
              equals: normalized.doctor.nombre,
              mode: "insensitive",
            },
          },
        },
      },
    ];

    if (normalized.doctor.matricula) {
      doctorMatchers.unshift({ matricula: normalized.doctor.matricula });
    }

    const existingDoctor = await tx.doctorProfile.findFirst({
      where: {
        OR: doctorMatchers,
      },
      select: { user_id: true },
    });

    if (existingDoctor) {
      doctorId = existingDoctor.user_id;

      await tx.doctorProfile.update({
        where: { user_id: doctorId },
        data: {
          specialty: normalized.doctor.especialidad,
          ...(normalized.doctor.matricula ? { matricula: normalized.doctor.matricula } : {}),
        },
      });

      await tx.user.update({
        where: { id: doctorId },
        data: { name: normalized.doctor.nombre },
      });

      const settings = await tx.agendaSettings.upsert({
        where: { user_id: doctorId },
        create: {
          user_id: doctorId,
          appointment_duration: defaultDuration,
          buffer_minutes: 10,
          start_time: "08:00",
          end_time: "18:00",
          working_days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
        },
        update: {},
        select: { appointment_duration: true },
      });

      appointmentDuration = settings.appointment_duration;
    } else {
      const emailDomain = resolveEmailDomain();
      let doctorMatricula = normalized.doctor.matricula;

      if (!doctorMatricula) {
        for (let attempt = 0; attempt < 8; attempt += 1) {
          const candidate = buildAutoMatricula(normalized.doctor.nombre);
          const exists = await tx.doctorProfile.findFirst({
            where: { matricula: candidate },
            select: { user_id: true },
          });
          if (!exists) {
            doctorMatricula = candidate;
            break;
          }
        }
      }

      if (!doctorMatricula) {
        throw new AiIntakeServiceError("No fue posible generar una matricula unica para el medico", 409);
      }

      const created = await createUniqueDoctorUser(
        tx,
        {
          nombre: normalized.doctor.nombre,
          matricula: doctorMatricula,
          especialidad: normalized.doctor.especialidad || "General",
        },
        defaultDuration,
        emailDomain,
      );
      doctorId = created.doctorId;
      appointmentDuration = created.appointmentDuration;
      doctorsCreated = 1;
    }

    await lockDoctorSchedule(tx, doctorId);

    const generated = generateSlotsFromSchedule(normalized.schedule, appointmentDuration);

    const orderedDates = normalized.schedule
      .map((day) => day.fecha)
      .slice()
      .sort((a, b) => a.localeCompare(b));

    const minDate = new Date(`${orderedDates[0]}T00:00:00.000Z`);
    const maxDate = new Date(`${orderedDates[orderedDates.length - 1]}T23:59:59.999Z`);

    const existingRules = await tx.availabilityRule.findMany({
      where: {
        doctor_id: doctorId,
        specific_date: {
          gte: minDate,
          lte: maxDate,
        },
      },
      select: {
        specific_date: true,
        start_time: true,
        end_time: true,
        slot_duration: true,
      },
    });

    const existingKeys = new Set(
      existingRules
        .filter((rule) => rule.specific_date !== null)
        .map((rule) => ruleKey(rule.specific_date as Date, rule.start_time, rule.end_time, rule.slot_duration)),
    );

    const toCreate: Array<{
      doctor_id: string;
      day_of_week: number;
      specific_date: Date;
      start_time: string;
      end_time: string;
      slot_duration: number;
    }> = [];

    let skipped = generated.skipped;

    for (const slot of generated.slots) {
      const key = ruleKey(slot.specificDate, slot.startTime, slot.endTime, slot.slotDuration);
      if (existingKeys.has(key)) {
        skipped += 1;
        continue;
      }

      existingKeys.add(key);
      toCreate.push({
        doctor_id: doctorId,
        day_of_week: slot.dayOfWeek,
        specific_date: slot.specificDate,
        start_time: slot.startTime,
        end_time: slot.endTime,
        slot_duration: slot.slotDuration,
      });
    }

    if (toCreate.length > 0) {
      await tx.availabilityRule.createMany({ data: toCreate });
    }

    return {
      status: "success" as const,
      doctor_id: doctorId,
      doctors_created: doctorsCreated,
      slots_created: toCreate.length,
      slots_skipped: skipped,
    };
  });

  return result;
}
