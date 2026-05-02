import { prisma } from "@/lib/prisma";

type AvailabilityRule = {
  day_of_week: number;
  specific_date: Date | null;
  start_time: string;
  end_time: string;
  slot_duration: number;
};

type BusyInterval = {
  id: string;
  start: Date;
  end: Date;
};

export type SuggestedSlot = {
  start: Date;
  end: Date;
  day_of_week: number;
  slot_duration: number;
  source: "availability_rule" | "preferred_fallback";
};

type FindNextAvailableSlotOptions = {
  tenantId: string;
  preferredStart?: Date;
  excludeAppointmentId?: string;
  maxSearchDays?: number;
  allowPreferredFallbackWhenNoRules?: boolean;
};

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function isSameCalendarDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function parseTimeToMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + minutes;
}

function withMinutes(baseDate: Date, minutes: number): Date {
  const next = new Date(baseDate);
  next.setHours(0, 0, 0, 0);
  next.setMinutes(minutes, 0, 0);
  return next;
}

function alignToStep(candidate: Date, base: Date, stepMinutes: number): Date {
  const diffMs = candidate.getTime() - base.getTime();
  if (diffMs <= 0) return new Date(base);

  const stepMs = stepMinutes * 60_000;
  const steps = Math.ceil(diffMs / stepMs);
  return new Date(base.getTime() + steps * stepMs);
}

function overlaps(candidateStart: Date, candidateEnd: Date, busy: BusyInterval[]): boolean {
  return busy.some((interval) => interval.start < candidateEnd && interval.end > candidateStart);
}

async function getDayBusyIntervals(
  doctorId: string,
  day: Date,
  tenantId: string,
  excludeAppointmentId?: string,
): Promise<BusyInterval[]> {
  const rows = await prisma.appointment.findMany({
    where: {
      tenant_id: tenantId,
      doctor_id: doctorId,
      deleted_at: null,
      datetime: {
        gte: startOfDay(day),
        lte: endOfDay(day),
      },
      status: { notIn: ["cancelled", "no_show"] },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
    },
    select: {
      id: true,
      datetime: true,
      duration: true,
    },
    orderBy: { datetime: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    start: row.datetime,
    end: new Date(row.datetime.getTime() + row.duration * 60_000),
  }));
}

export async function detectAvailableGaps(
  doctor_id: string,
  duration: number,
  options?: FindNextAvailableSlotOptions,
): Promise<SuggestedSlot[]> {
  const preferredStart = options?.preferredStart ?? new Date();
  const maxSearchDays = options?.maxSearchDays ?? 30;
  const tenantId = options?.tenantId;
  if (!tenantId) {
    throw new Error("tenantId is required to compute schedule availability");
  }

  const rules = await prisma.availabilityRule.findMany({
    where: { tenant_id: tenantId, doctor_id },
    select: {
      day_of_week: true,
      specific_date: true,
      start_time: true,
      end_time: true,
      slot_duration: true,
    },
    orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
  });

  if (rules.length === 0) {
    console.warn(`[smart-schedule] doctor ${doctor_id} sin availability rules`);

    if (options?.allowPreferredFallbackWhenNoRules) {
      const fallbackStart = new Date(preferredStart);
      const fallbackEnd = new Date(fallbackStart.getTime() + duration * 60_000);
      const busy = await getDayBusyIntervals(doctor_id, fallbackStart, tenantId, options?.excludeAppointmentId);

      if (!overlaps(fallbackStart, fallbackEnd, busy)) {
        return [
          {
            start: fallbackStart,
            end: fallbackEnd,
            day_of_week: fallbackStart.getDay(),
            slot_duration: Math.max(5, duration),
            source: "preferred_fallback",
          },
        ];
      }
    }

    return [];
  }

  const rulesByDay = new Map<number, AvailabilityRule[]>();
  const specificDateRules: AvailabilityRule[] = [];
  for (const rule of rules) {
    if (rule.specific_date) {
      specificDateRules.push(rule);
      continue;
    }

    const list = rulesByDay.get(rule.day_of_week) ?? [];
    list.push(rule);
    rulesByDay.set(rule.day_of_week, list);
  }

  const suggestions: SuggestedSlot[] = [];

  for (let dayOffset = 0; dayOffset < maxSearchDays; dayOffset += 1) {
    const day = new Date(preferredStart);
    day.setDate(preferredStart.getDate() + dayOffset);
    day.setHours(0, 0, 0, 0);

    const dayRules = [
      ...(rulesByDay.get(day.getDay()) ?? []),
      ...specificDateRules.filter((rule) => rule.specific_date && isSameCalendarDay(rule.specific_date, day)),
    ];
    if (dayRules.length === 0) continue;

    const busy = await getDayBusyIntervals(doctor_id, day, tenantId, options?.excludeAppointmentId);

    for (const rule of dayRules) {
      const ruleStart = withMinutes(day, parseTimeToMinutes(rule.start_time));
      const ruleEnd = withMinutes(day, parseTimeToMinutes(rule.end_time));

      if (ruleStart >= ruleEnd) continue;

      const rawStart = dayOffset === 0 && preferredStart > ruleStart ? preferredStart : ruleStart;
      let cursor = alignToStep(rawStart, ruleStart, Math.max(5, rule.slot_duration));

      while (cursor < ruleEnd) {
        const candidateEnd = new Date(cursor.getTime() + duration * 60_000);
        if (candidateEnd > ruleEnd) break;

        if (!overlaps(cursor, candidateEnd, busy)) {
          suggestions.push({
            start: new Date(cursor),
            end: candidateEnd,
            day_of_week: rule.day_of_week,
            slot_duration: rule.slot_duration,
            source: "availability_rule",
          });
        }

        cursor = new Date(cursor.getTime() + Math.max(5, rule.slot_duration) * 60_000);
      }
    }

    if (suggestions.length >= 20) break;
  }

  return suggestions;
}

export async function suggestOptimalSlots(
  doctor_id: string,
  duration: number,
  limit = 5,
  options?: FindNextAvailableSlotOptions,
): Promise<SuggestedSlot[]> {
  const gaps = await detectAvailableGaps(doctor_id, duration, options);
  return gaps.slice(0, Math.max(1, limit));
}

// API solicitada: findNextAvailableSlot(doctor_id, duration)
export async function findNextAvailableSlot(
  doctor_id: string,
  duration: number,
  options?: FindNextAvailableSlotOptions,
): Promise<SuggestedSlot | null> {
  const [first] = await suggestOptimalSlots(doctor_id, duration, 1, options);

  if (first) {
    console.info(
      `[smart-schedule] slot found doctor=${doctor_id} start=${first.start.toISOString()} duration=${duration}`,
    );
    return first;
  }

  console.warn(`[smart-schedule] no slot found doctor=${doctor_id} duration=${duration}`);
  return null;
}
