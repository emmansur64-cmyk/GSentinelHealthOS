import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  incAppointmentEngineConflict,
  incOverbookingDecision,
  observeAppointmentEngineDecision,
} from "@/lib/observability/metrics";
import {
  getHighRiskThreshold,
  getOverbookingMaxConcurrent,
  isOverbookingEnabled,
  predictNoShowByAppointmentId,
  predictNoShowForSlot,
  type RiskLevel,
} from "@/services/predictionEngine";
import {
  createAppointmentRecord,
  findOverlappingAppointment,
  lockDoctorForScheduling,
  upsertPatientByDocument,
  verifySlotCoverageInRules,
} from "@/repositories/appointmentRepository";
import {
  findDoctorCandidates,
  getAvailabilityRulesForRange,
  getOccupiedIntervalsForRange,
  type AutoAssignDoctorCandidate,
  type AvailabilityRuleRecord,
  type OccupiedInterval,
} from "@/repositories/availabilityRepository";
import { z } from "zod";
import {
  CONSULTATION_TYPE_DURATION,
  getConsultationDuration,
  normalizeConsultationType as normalizeConsultationTypeValue,
  type ConsultationType,
} from "@/lib/agenda/consultation-type";

export const autoAssignInputSchema = z
  .object({
    patient: z
      .object({
        nombre: z.string().min(2).max(120),
        documento: z.string().min(6).max(40),
        telefono: z.string().min(8).max(30).optional(),
      })
      .strict(),
    filters: z
      .object({
        especialidad: z.string().min(2).max(120),
        doctor_id: z.uuid().optional(),
        fecha_desde: z.iso.date(),
        fecha_hasta: z.iso.date(),
        preferencia_horaria: z.enum(["manana", "tarde", "indiferente", "mañana"]),
        tipo_consulta: z.enum(["primera_vez", "primera vez", "control", "urgencia"]).default("control"),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const from = new Date(`${value.filters.fecha_desde}T00:00:00.000Z`);
    const to = new Date(`${value.filters.fecha_hasta}T00:00:00.000Z`);

    if (from.getTime() > to.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["filters", "fecha_desde"],
        message: "fecha_desde no puede ser mayor a fecha_hasta",
      });
    }
  });

export type AutoAssignInput = z.infer<typeof autoAssignInputSchema>;

type TimePreference = "manana" | "tarde" | "indiferente";

type CandidateSlot = {
  doctorId: string;
  doctorName: string;
  specialty: string;
  slotStart: Date;
  slotEnd: Date;
  duration: number;
  stepMinutes: number;
  temporalDistanceMs: number;
  fragmentationScore: number;
  noShowProbability: number;
  riskLevel: RiskLevel;
  overbookingEligible: boolean;
};

type AssignmentAttempt = {
  doctor_id: string;
  slot: string;
  result: "assigned" | "conflict_overlap" | "conflict_rule_mismatch";
  overbooked?: boolean;
  risk_level?: RiskLevel;
  no_show_probability?: number;
};

export type AutoAssignResult =
  | {
      status: "assigned";
      appointment: {
        id: string;
        doctor: string;
        fecha: string;
        hora: string;
        tipo_consulta: ConsultationType;
        duracion: number;
      };
      attempts: AssignmentAttempt[];
    }
  | {
      status: "no_availability";
      attempts: AssignmentAttempt[];
    };

function cleanText(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
}

function toTitleCase(value: string): string {
  return cleanText(value)
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((chunk) => `${chunk.charAt(0).toUpperCase()}${chunk.slice(1)}`)
    .join(" ");
}

function normalizeDocument(value: string): string {
  return cleanText(value).toUpperCase();
}

function normalizePhone(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = cleanText(value).replace(/[^\d+]/g, "");
  return normalized || undefined;
}

function normalizeConsultationType(value: AutoAssignInput["filters"]["tipo_consulta"]): ConsultationType {
  const normalized = normalizeConsultationTypeValue(value);
  if (!normalized) return "control";
  return normalized;
}

function normalizePreference(value: AutoAssignInput["filters"]["preferencia_horaria"]): TimePreference {
  if (value === "mañana") return "manana";
  return value;
}

function parseHHmmToMinutes(time: string): number {
  const [hour, minute] = time.split(":").map((part) => Number(part));
  return hour * 60 + minute;
}

function toDateRange(fromISO: string, toISO: string): { from: Date; to: Date } {
  const from = new Date(`${fromISO}T00:00:00.000Z`);
  const to = new Date(`${toISO}T23:59:59.999Z`);
  return { from, to };
}

function buildDateList(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);

  while (cursor.getTime() <= to.getTime()) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function isSameUTCDate(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function overlaps(start: Date, end: Date, intervals: OccupiedInterval[]): boolean {
  return intervals.some((interval) => interval.start < end && interval.end > start);
}

function preferenceMatches(slotStart: Date, preference: TimePreference): boolean {
  if (preference === "indiferente") return true;
  const hour = slotStart.getHours();
  if (preference === "manana") return hour >= 6 && hour < 12;
  return hour >= 12 && hour < 20;
}

function fragmentationScore(slotStart: Date, slotEnd: Date, busy: OccupiedInterval[]): number {
  let prevGap = Number.POSITIVE_INFINITY;
  let nextGap = Number.POSITIVE_INFINITY;

  for (const interval of busy) {
    if (interval.end.getTime() <= slotStart.getTime()) {
      prevGap = Math.min(prevGap, slotStart.getTime() - interval.end.getTime());
      continue;
    }

    if (interval.start.getTime() >= slotEnd.getTime()) {
      nextGap = Math.min(nextGap, interval.start.getTime() - slotEnd.getTime());
    }
  }

  const nearest = Math.min(prevGap, nextGap);
  if (!Number.isFinite(nearest)) return Number.MAX_SAFE_INTEGER;
  return nearest;
}

function getApplicableRulesForDay(rules: AvailabilityRuleRecord[], day: Date): AvailabilityRuleRecord[] {
  const weekly = rules.filter((rule) => rule.specific_date === null && rule.day_of_week === day.getDay());
  const specific = rules.filter((rule) => rule.specific_date !== null && isSameUTCDate(rule.specific_date as Date, day));
  return [...weekly, ...specific];
}

function formatFecha(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatHora(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function plusDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function buildSlotIdempotencyKey(input: {
  doctorId: string;
  slotStart: Date;
  duration: number;
  patientDocument: string;
  consultationType: ConsultationType;
}): string {
  const normalizedDoc = input.patientDocument.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return `autoassign:${input.doctorId}:${input.slotStart.toISOString()}:${input.duration}:${input.consultationType}:${normalizedDoc}`;
}

function sortCandidateSlots(candidates: CandidateSlot[]): CandidateSlot[] {
  return candidates.sort((a, b) => {
    if (a.noShowProbability !== b.noShowProbability) {
      return a.noShowProbability - b.noShowProbability;
    }
    if (a.temporalDistanceMs !== b.temporalDistanceMs) {
      return a.temporalDistanceMs - b.temporalDistanceMs;
    }
    if (a.fragmentationScore !== b.fragmentationScore) {
      return a.fragmentationScore - b.fragmentationScore;
    }
    return a.slotStart.getTime() - b.slotStart.getTime();
  });
}

type CandidatePoolInput = {
  tenantId: string;
  doctors: AutoAssignDoctorCandidate[];
  from: Date;
  to: Date;
  preference: TimePreference;
  now: Date;
  patientDocument: string;
  consultationType: ConsultationType;
};

async function buildCandidatePool(input: CandidatePoolInput): Promise<CandidateSlot[]> {
  const doctorIds = input.doctors.map((doctor) => doctor.user_id);
  const [rules, occupied] = await Promise.all([
    getAvailabilityRulesForRange({ tenantId: input.tenantId, doctorIds, from: input.from, to: input.to }),
    getOccupiedIntervalsForRange({ tenantId: input.tenantId, doctorIds, from: input.from, to: input.to }),
  ]);

  const rulesByDoctor = new Map<string, AvailabilityRuleRecord[]>();
  for (const rule of rules) {
    const list = rulesByDoctor.get(rule.doctor_id) ?? [];
    list.push(rule);
    rulesByDoctor.set(rule.doctor_id, list);
  }

  const occupiedByDoctor = new Map<string, OccupiedInterval[]>();
  for (const interval of occupied) {
    const list = occupiedByDoctor.get(interval.doctor_id) ?? [];
    list.push(interval);
    occupiedByDoctor.set(interval.doctor_id, list);
  }

  const dates = buildDateList(input.from, input.to);
  const candidates: CandidateSlot[] = [];

  for (const doctor of input.doctors) {
    const doctorRules = rulesByDoctor.get(doctor.user_id) ?? [];
    const doctorBusy = occupiedByDoctor.get(doctor.user_id) ?? [];
    const duration = getConsultationDuration(input.consultationType);

    for (const day of dates) {
      const dayRules = getApplicableRulesForDay(doctorRules, day);
      if (dayRules.length === 0) continue;

      const busyOfDay = doctorBusy.filter((interval) => {
        const from = new Date(day);
        const to = new Date(day);
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
        return interval.start.getTime() <= to.getTime() && interval.end.getTime() >= from.getTime();
      });

      for (const rule of dayRules) {
        const ruleStart = parseHHmmToMinutes(rule.start_time);
        const ruleEnd = parseHHmmToMinutes(rule.end_time);
        const stepMinutes = Math.max(5, rule.slot_duration);

        if (ruleEnd <= ruleStart || duration > ruleEnd - ruleStart) continue;

        for (let minute = ruleStart; minute + duration <= ruleEnd; minute += stepMinutes) {
          const slotStart = new Date(day);
          slotStart.setHours(0, 0, 0, 0);
          slotStart.setMinutes(minute, 0, 0);

          const slotEnd = new Date(slotStart.getTime() + duration * 60_000);
          if (slotStart.getTime() < input.now.getTime()) continue;
          if (!preferenceMatches(slotStart, input.preference)) continue;
          if (overlaps(slotStart, slotEnd, busyOfDay)) continue;

          candidates.push({
            doctorId: doctor.user_id,
            doctorName: doctor.user.name,
            specialty: doctor.specialty,
            slotStart,
            slotEnd,
            duration,
            stepMinutes,
            temporalDistanceMs: Math.abs(slotStart.getTime() - input.now.getTime()),
            fragmentationScore: fragmentationScore(slotStart, slotEnd, busyOfDay),
            noShowProbability: 0.5,
            riskLevel: "medio",
            overbookingEligible: false,
          });
        }
      }
    }
  }

  return sortCandidateSlots(candidates);
}

class SlotConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlotConflictError";
  }
}

async function scoreCandidateSlots(
  candidates: CandidateSlot[],
  input: {
    patientDocument: string;
    now: Date;
  },
): Promise<CandidateSlot[]> {
  const maxCandidates = Math.max(20, Number(process.env.AUTO_ASSIGN_RISK_MAX_CANDIDATES ?? 200));
  const highRiskThreshold = getHighRiskThreshold();
  const overbookingEnabled = isOverbookingEnabled();

  const limited = candidates.slice(0, maxCandidates);

  const scored = await Promise.all(
    limited.map(async (candidate) => {
      const prediction = await predictNoShowForSlot({
        doctorId: candidate.doctorId,
        specialty: candidate.specialty,
        appointmentDateTime: candidate.slotStart,
        createdAt: input.now,
        patientDocument: input.patientDocument,
      });

      return {
        ...candidate,
        noShowProbability: prediction.probability,
        riskLevel: prediction.riskLevel,
        overbookingEligible: overbookingEnabled && prediction.probability >= highRiskThreshold,
      };
    }),
  );

  const lowRisk = scored.filter((candidate) => candidate.noShowProbability < highRiskThreshold);
  if (lowRisk.length > 0) {
    return sortCandidateSlots(lowRisk);
  }

  return sortCandidateSlots(scored);
}

async function countOverlapsInSlot(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    doctorId: string;
    slotStart: Date;
    slotEnd: Date;
  },
): Promise<number> {
  const rows = await tx.$queryRaw<{ total: number }[]>`
    SELECT COUNT(*)::int AS total
    FROM appointments
    WHERE tenant_id = ${input.tenantId}
      AND doctor_id = ${input.doctorId}
      AND deleted_at IS NULL
      AND status NOT IN ('cancelled', 'no_show')
      AND datetime < ${input.slotEnd}
      AND datetime + (duration || ' minutes')::interval > ${input.slotStart}
  `;

  return Number(rows[0]?.total ?? 0);
}

export async function autoAssignAppointment(rawInput: unknown, options: { tenantId: string }): Promise<AutoAssignResult> {
  const startedAt = Date.now();
  const parsed = autoAssignInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    observeAppointmentEngineDecision({
      outcome: "error",
      fallbackUsed: false,
      durationMs: Date.now() - startedAt,
      attempts: 0,
    });
    throw new Error(JSON.stringify({
      code: "INVALID_PAYLOAD",
      details: parsed.error.flatten(),
    }));
  }

  const normalizedInput = {
    patient: {
      nombre: toTitleCase(parsed.data.patient.nombre),
      documento: normalizeDocument(parsed.data.patient.documento),
      telefono: normalizePhone(parsed.data.patient.telefono),
    },
    filters: {
      especialidad: toTitleCase(parsed.data.filters.especialidad),
      doctor_id: parsed.data.filters.doctor_id,
      fecha_desde: parsed.data.filters.fecha_desde,
      fecha_hasta: parsed.data.filters.fecha_hasta,
      preferencia_horaria: normalizePreference(parsed.data.filters.preferencia_horaria),
      tipo_consulta: normalizeConsultationType(parsed.data.filters.tipo_consulta),
    },
  };

  const doctors = await findDoctorCandidates({
    tenantId: options.tenantId,
    specialty: normalizedInput.filters.especialidad,
    doctorId: normalizedInput.filters.doctor_id,
  });

  if (doctors.length === 0) {
    return { status: "no_availability", attempts: [] };
  }

  const range = toDateRange(normalizedInput.filters.fecha_desde, normalizedInput.filters.fecha_hasta);
  const now = new Date();
  let fallbackUsed = false;

  let candidates = await buildCandidatePool({
    tenantId: options.tenantId,
    doctors,
    from: range.from,
    to: range.to,
    preference: normalizedInput.filters.preferencia_horaria,
    now,
    patientDocument: normalizedInput.patient.documento,
    consultationType: normalizedInput.filters.tipo_consulta,
  });

  if (candidates.length === 0) {
    const fallbackTo = plusDays(range.to, 3);
    fallbackUsed = true;
    candidates = await buildCandidatePool({
      tenantId: options.tenantId,
      doctors,
      from: range.from,
      to: fallbackTo,
      preference: normalizedInput.filters.preferencia_horaria,
      now,
      patientDocument: normalizedInput.patient.documento,
      consultationType: normalizedInput.filters.tipo_consulta,
    });
  }

  if (candidates.length === 0) {
    observeAppointmentEngineDecision({
      outcome: "no_availability",
      fallbackUsed,
      durationMs: Date.now() - startedAt,
      attempts: 0,
    });
    return { status: "no_availability", attempts: [] };
  }

  const attempts: AssignmentAttempt[] = [];
  const scoredCandidates = await scoreCandidateSlots(candidates, {
    patientDocument: normalizedInput.patient.documento,
    now,
  });

  for (const candidate of scoredCandidates) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        await lockDoctorForScheduling(tx, candidate.doctorId);

        const covered = await verifySlotCoverageInRules(tx, {
          tenantId: options.tenantId,
          doctorId: candidate.doctorId,
          slotStart: candidate.slotStart,
          slotEnd: candidate.slotEnd,
          stepMinutes: candidate.stepMinutes,
        });

        if (!covered) {
          throw new SlotConflictError("RULE_MISMATCH");
        }

        const overlap = await findOverlappingAppointment(tx, {
          tenantId: options.tenantId,
          doctorId: candidate.doctorId,
          slotStart: candidate.slotStart,
          slotEnd: candidate.slotEnd,
        });

        let overbooked = false;
        if (overlap) {
          const overlapCount = await countOverlapsInSlot(tx, {
            tenantId: options.tenantId,
            doctorId: candidate.doctorId,
            slotStart: candidate.slotStart,
            slotEnd: candidate.slotEnd,
          });

          const canOverbook =
            candidate.overbookingEligible &&
            overlapCount < getOverbookingMaxConcurrent();

          if (!canOverbook) {
            incOverbookingDecision("denied");
            throw new SlotConflictError("OVERLAP");
          }

          overbooked = true;
          incOverbookingDecision("allowed");
        }

        const patient = await upsertPatientByDocument(tx, { tenantId: options.tenantId, ...normalizedInput.patient });

        const idempotencyKey = buildSlotIdempotencyKey({
          doctorId: candidate.doctorId,
          slotStart: candidate.slotStart,
          duration: candidate.duration,
          patientDocument: normalizedInput.patient.documento,
          consultationType: normalizedInput.filters.tipo_consulta,
        });

        return createAppointmentRecord(tx, {
          patientId: patient.id,
          doctorId: candidate.doctorId,
          tenantId: options.tenantId,
          slotStart: candidate.slotStart,
          duration: candidate.duration,
          notes: overbooked
            ? `Asignado automaticamente por appointmentEngine | tipo_consulta=${normalizedInput.filters.tipo_consulta} | duracion=${candidate.duration}min | confirmacion=pendiente | riesgo=${candidate.riskLevel} | overbooking=controlado`
            : `Asignado automaticamente por appointmentEngine | tipo_consulta=${normalizedInput.filters.tipo_consulta} | duracion=${candidate.duration}min | confirmacion=pendiente`,
          idempotencyKey,
        });
      }, { timeout: 10000 });

      await predictNoShowByAppointmentId(created.id, options.tenantId);

      attempts.push({
        doctor_id: candidate.doctorId,
        slot: candidate.slotStart.toISOString(),
        result: "assigned",
        risk_level: candidate.riskLevel,
        no_show_probability: Number(candidate.noShowProbability.toFixed(4)),
      });

      observeAppointmentEngineDecision({
        outcome: "assigned",
        fallbackUsed,
        durationMs: Date.now() - startedAt,
        attempts: attempts.length,
      });

      return {
        status: "assigned",
        appointment: {
          id: created.id,
          doctor: created.doctor.user.name,
          fecha: formatFecha(created.datetime),
          hora: formatHora(created.datetime),
          tipo_consulta: normalizedInput.filters.tipo_consulta,
          duracion: candidate.duration,
        },
        attempts,
      };
    } catch (error) {
      if (error instanceof SlotConflictError) {
        if (error.message === "OVERLAP") {
          incAppointmentEngineConflict("overlap");
        } else {
          incAppointmentEngineConflict("rule_mismatch");
        }

        attempts.push({
          doctor_id: candidate.doctorId,
          slot: candidate.slotStart.toISOString(),
          result: error.message === "OVERLAP" ? "conflict_overlap" : "conflict_rule_mismatch",
          risk_level: candidate.riskLevel,
          no_show_probability: Number(candidate.noShowProbability.toFixed(4)),
        });
        continue;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        incAppointmentEngineConflict("overlap");
        attempts.push({
          doctor_id: candidate.doctorId,
          slot: candidate.slotStart.toISOString(),
          result: "conflict_overlap",
          risk_level: candidate.riskLevel,
          no_show_probability: Number(candidate.noShowProbability.toFixed(4)),
        });
        continue;
      }

      throw error;
    }
  }

  observeAppointmentEngineDecision({
    outcome: "no_availability",
    fallbackUsed,
    durationMs: Date.now() - startedAt,
    attempts: attempts.length,
  });

  return {
    status: "no_availability",
    attempts,
  };
}
