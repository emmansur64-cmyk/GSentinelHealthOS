import { getAvailabilityRulesForRange, getDoctorAppointmentDurations, getOccupiedIntervalsForRange } from "@/repositories/availabilityRepository";
import { prisma } from "@/lib/prisma";
import { observeRecommendationGeneration } from "@/lib/observability/metrics";
import { getDoctorScoreSnapshot, predictNoShowForSlot } from "@/services/predictionEngine";

type TimeBucket = "manana" | "tarde" | "noche";

type CandidateSlot = {
  doctorId: string;
  doctorName: string;
  specialty: string;
  start: Date;
  end: Date;
  predictedNoShow: number;
  riskLevel: "bajo" | "medio" | "alto";
  score: number;
};

type GapRecommendation = {
  doctor_id: string;
  doctor_name: string;
  specialty: string;
  date: string;
  gap_start: string;
  gap_end: string;
  idle_minutes: number;
  suggestion: string;
};

export type RecommendationsResponse = {
  generated_at: string;
  mejores_horarios_disponibles: Array<{
    doctor_id: string;
    doctor_name: string;
    specialty: string;
    start: string;
    end: string;
    probabilidad_no_show: number;
    risk_level: "bajo" | "medio" | "alto";
    confidence_score: number;
  }>;
  medicos_menor_tasa_cancelacion: Array<{
    doctor_id: string;
    doctor_name: string;
    specialty: string;
    no_show_rate: number;
    sample_size: number;
  }>;
  slots_optimos: Array<{
    doctor_id: string;
    doctor_name: string;
    specialty: string;
    start: string;
    end: string;
    score: number;
  }>;
  gaps_detectados: GapRecommendation[];
  acciones_sugeridas: string[];
};

function parseHHmmToMinutes(time: string): number {
  const [hour, minute] = time.split(":").map((part) => Number(part));
  return hour * 60 + minute;
}

function formatDateYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getDayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function toTimeBucket(hour: number): TimeBucket {
  if (hour < 12) return "manana";
  if (hour < 18) return "tarde";
  return "noche";
}

function compactnessScore(hour: number, noShowProbability: number): number {
  const bucket = toTimeBucket(hour);
  const bucketWeight = bucket === "manana" ? 1 : bucket === "tarde" ? 0.92 : 0.8;
  const reliability = 1 - noShowProbability;
  return Number((bucketWeight * reliability).toFixed(4));
}

function overlaps(start: Date, end: Date, busy: Array<{ start: Date; end: Date }>): boolean {
  return busy.some((interval) => interval.start < end && interval.end > start);
}

function dateList(from: Date, days: number): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);

  for (let i = 0; i < days; i += 1) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

async function getDoctorCatalog(
  tenantId: string,
  specialty?: string,
): Promise<Array<{ doctor_id: string; doctor_name: string; specialty: string }>> {
  const rows = await prisma.$queryRaw<Array<{ doctor_id: string; doctor_name: string; specialty: string }>>`
    SELECT d.user_id AS doctor_id, u.name AS doctor_name, d.specialty
    FROM doctor_profiles d
    INNER JOIN users u ON u.id = d.user_id
    WHERE d.tenant_id = ${tenantId}
      AND (${specialty ?? null}::text IS NULL OR d.specialty ILIKE ${`%${specialty ?? ""}%`})
    ORDER BY u.name ASC
  `;

  return rows;
}

async function buildCandidateSlots(input: {
  tenantId: string;
  specialty?: string;
  limit: number;
  horizonDays: number;
}): Promise<CandidateSlot[]> {
  const doctors = await getDoctorCatalog(input.tenantId, input.specialty);
  if (doctors.length === 0) return [];

  const doctorIds = doctors.map((doctor) => doctor.doctor_id);
  const now = new Date();
  const horizon = dateList(now, input.horizonDays);
  const from = horizon[0] ?? now;
  const to = horizon[horizon.length - 1] ?? now;

  const [rules, occupied, durations] = await Promise.all([
    getAvailabilityRulesForRange({ tenantId: input.tenantId, doctorIds, from, to }),
    getOccupiedIntervalsForRange({ tenantId: input.tenantId, doctorIds, from, to }),
    getDoctorAppointmentDurations(doctorIds),
  ]);

  const rulesByDoctor = new Map<string, typeof rules>();
  for (const rule of rules) {
    const current = rulesByDoctor.get(rule.doctor_id) ?? [];
    current.push(rule);
    rulesByDoctor.set(rule.doctor_id, current);
  }

  const occupiedByDoctor = new Map<string, Array<{ start: Date; end: Date }>>();
  for (const row of occupied) {
    const current = occupiedByDoctor.get(row.doctor_id) ?? [];
    current.push({ start: row.start, end: row.end });
    occupiedByDoctor.set(row.doctor_id, current);
  }

  const doctorById = new Map(doctors.map((item) => [item.doctor_id, item]));
  const candidates: CandidateSlot[] = [];

  for (const doctorId of doctorIds) {
    const doctor = doctorById.get(doctorId);
    if (!doctor) continue;

    const duration = Math.max(10, durations.get(doctorId) ?? 30);
    const doctorRules = rulesByDoctor.get(doctorId) ?? [];
    const doctorBusy = occupiedByDoctor.get(doctorId) ?? [];

    for (const day of horizon) {
      const dayOfWeek = day.getDay();
      const dayRules = doctorRules.filter((rule) => {
        if (rule.specific_date) {
          return formatDateYYYYMMDD(rule.specific_date) === formatDateYYYYMMDD(day);
        }
        return rule.day_of_week === dayOfWeek;
      });

      if (dayRules.length === 0) continue;

      for (const rule of dayRules) {
        const startMinute = parseHHmmToMinutes(rule.start_time);
        const endMinute = parseHHmmToMinutes(rule.end_time);
        const step = Math.max(5, rule.slot_duration);

        for (let minute = startMinute; minute + duration <= endMinute; minute += step) {
          const slotStart = new Date(day);
          slotStart.setHours(0, minute, 0, 0);
          const slotEnd = new Date(slotStart.getTime() + duration * 60_000);

          if (slotStart <= now) continue;
          if (overlaps(slotStart, slotEnd, doctorBusy)) continue;

          const prediction = await predictNoShowForSlot({
            doctorId,
            specialty: doctor.specialty,
            appointmentDateTime: slotStart,
            createdAt: now,
          });

          const score = compactnessScore(slotStart.getHours(), prediction.probability);

          candidates.push({
            doctorId,
            doctorName: doctor.doctor_name,
            specialty: doctor.specialty,
            start: slotStart,
            end: slotEnd,
            predictedNoShow: prediction.probability,
            riskLevel: prediction.riskLevel,
            score,
          });
        }
      }
    }
  }

  candidates.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.predictedNoShow !== b.predictedNoShow) return a.predictedNoShow - b.predictedNoShow;
    return a.start.getTime() - b.start.getTime();
  });

  return candidates.slice(0, Math.max(input.limit * 3, 15));
}

async function detectScheduleGaps(input: {
  tenantId: string;
  specialty?: string;
  maxDoctors: number;
  maxDays: number;
}): Promise<GapRecommendation[]> {
  const doctors = await getDoctorCatalog(input.tenantId, input.specialty);
  const selectedDoctors = doctors.slice(0, Math.max(1, input.maxDoctors));
  if (selectedDoctors.length === 0) return [];

  const doctorIds = selectedDoctors.map((item) => item.doctor_id);
  const dates = dateList(new Date(), input.maxDays);
  const from = dates[0] ?? new Date();
  const to = dates[dates.length - 1] ?? new Date();

  const [rules, occupied] = await Promise.all([
    getAvailabilityRulesForRange({ tenantId: input.tenantId, doctorIds, from, to }),
    getOccupiedIntervalsForRange({ tenantId: input.tenantId, doctorIds, from, to }),
  ]);

  const doctorById = new Map(selectedDoctors.map((doctor) => [doctor.doctor_id, doctor]));
  const gaps: GapRecommendation[] = [];

  for (const doctor of selectedDoctors) {
    const doctorRules = rules.filter((rule) => rule.doctor_id === doctor.doctor_id);
    const doctorBusy = occupied.filter((row) => row.doctor_id === doctor.doctor_id);

    for (const date of dates) {
      const dayRules = doctorRules.filter((rule) => {
        if (rule.specific_date) {
          return formatDateYYYYMMDD(rule.specific_date) === formatDateYYYYMMDD(date);
        }
        return rule.day_of_week === date.getDay();
      });

      if (dayRules.length === 0) continue;

      const { start: dayStart, end: dayEnd } = getDayRange(date);
      const busyIntervals = doctorBusy
        .filter((interval) => interval.start <= dayEnd && interval.end >= dayStart)
        .map((interval) => ({ start: interval.start, end: interval.end }))
        .sort((a, b) => a.start.getTime() - b.start.getTime());

      for (const rule of dayRules) {
        const windowStart = new Date(date);
        windowStart.setHours(0, parseHHmmToMinutes(rule.start_time), 0, 0);
        const windowEnd = new Date(date);
        windowEnd.setHours(0, parseHHmmToMinutes(rule.end_time), 0, 0);

        let cursor = windowStart;
        for (const busy of busyIntervals) {
          if (busy.end <= windowStart || busy.start >= windowEnd) continue;

          if (busy.start > cursor) {
            const gapMinutes = Math.round((busy.start.getTime() - cursor.getTime()) / 60000);
            if (gapMinutes >= rule.slot_duration * 2) {
              gaps.push({
                doctor_id: doctor.doctor_id,
                doctor_name: doctor.doctor_name,
                specialty: doctor.specialty,
                date: formatDateYYYYMMDD(date),
                gap_start: cursor.toISOString(),
                gap_end: busy.start.toISOString(),
                idle_minutes: gapMinutes,
                suggestion:
                  "Compactar turnos adelantando un paciente de baja complejidad o mover control breve para reducir tiempo ocioso.",
              });
            }
          }

          if (busy.end > cursor) {
            cursor = busy.end;
          }
        }

        if (cursor < windowEnd) {
          const trailingGapMinutes = Math.round((windowEnd.getTime() - cursor.getTime()) / 60000);
          if (trailingGapMinutes >= rule.slot_duration * 2) {
            gaps.push({
              doctor_id: doctor.doctor_id,
              doctor_name: doctor.doctor_name,
              specialty: doctor.specialty,
              date: formatDateYYYYMMDD(date),
              gap_start: cursor.toISOString(),
              gap_end: windowEnd.toISOString(),
              idle_minutes: trailingGapMinutes,
              suggestion: "Reservar bloque para pacientes de alta probabilidad de asistencia y minimizar fragmentacion.",
            });
          }
        }
      }
    }
  }

  gaps.sort((a, b) => b.idle_minutes - a.idle_minutes);
  return gaps.slice(0, 20);
}

export async function getRecommendations(input: {
  tenantId: string;
  specialty?: string;
  limit?: number;
  horizonDays?: number;
}): Promise<RecommendationsResponse> {
  const startedAt = Date.now();
  const limit = Math.max(3, Math.min(input?.limit ?? 10, 30));
  const horizonDays = Math.max(3, Math.min(input?.horizonDays ?? 14, 45));

  const [candidateSlots, doctors, gaps] = await Promise.all([
    buildCandidateSlots({ tenantId: input.tenantId, specialty: input?.specialty, limit, horizonDays }),
    getDoctorScoreSnapshot({ specialty: input?.specialty, limit }),
    detectScheduleGaps({ tenantId: input.tenantId, specialty: input?.specialty, maxDoctors: 8, maxDays: 7 }),
  ]);

  const bestSlots = candidateSlots.slice(0, limit).map((slot) => ({
    doctor_id: slot.doctorId,
    doctor_name: slot.doctorName,
    specialty: slot.specialty,
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
    probabilidad_no_show: Number(slot.predictedNoShow.toFixed(4)),
    risk_level: slot.riskLevel,
    confidence_score: Number(slot.score.toFixed(4)),
  }));

  const optimal = candidateSlots.slice(0, limit).map((slot) => ({
    doctor_id: slot.doctorId,
    doctor_name: slot.doctorName,
    specialty: slot.specialty,
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
    score: Number(slot.score.toFixed(4)),
  }));

  const actions: string[] = [];
  if (bestSlots.length > 0) {
    actions.push("Priorizar slots con riesgo bajo en franja manana/tarde para reducir no-show y mejorar ocupacion efectiva.");
  }
  if (doctors.length > 0) {
    actions.push("Asignar demanda flexible a medicos con menor tasa historica de no-show para estabilizar el flujo diario.");
  }
  if (gaps.length > 0) {
    actions.push("Reubicar controles cortos en huecos largos para compactar agenda y reducir fragmentacion operativa.");
  }

  const durationMs = Date.now() - startedAt;
  observeRecommendationGeneration({ durationMs, slots: bestSlots.length });

  return {
    generated_at: new Date().toISOString(),
    mejores_horarios_disponibles: bestSlots,
    medicos_menor_tasa_cancelacion: doctors,
    slots_optimos: optimal,
    gaps_detectados: gaps,
    acciones_sugeridas: actions,
  };
}
