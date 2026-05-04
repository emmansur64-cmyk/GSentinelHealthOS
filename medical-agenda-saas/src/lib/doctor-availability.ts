import { prisma } from "@/lib/prisma";

export type ProfessionalAvailabilityBlock = {
  doctor_id: string;
  day_of_week: number;
  specific_date: Date | null;
  start_time: string;
  end_time: string;
  slot_duration: number;
  source: "weekly_rule" | "specific_rule" | "monthly_slot";
};

type ProfessionalAvailabilityOptions = {
  tenantId: string;
  excludeAppointmentId?: string;
};

function toUtcDateOnly(value: Date | string): Date {
  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  }

  return new Date(`${value}T00:00:00.000Z`);
}

function dateKeyUtc(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseTimeToMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + minutes;
}

export function hasOverlappingTimeRanges(slots: Array<{ start_time: string; end_time: string }>): boolean {
  const sorted = [...slots].sort((left, right) => left.start_time.localeCompare(right.start_time));
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].start_time < sorted[index - 1].end_time) {
      return true;
    }
  }
  return false;
}

export async function getAvailabilityRulesForRangeResolved(input: {
  tenantId: string;
  doctorIds: string[];
  from: Date;
  to: Date;
}): Promise<ProfessionalAvailabilityBlock[]> {
  if (input.doctorIds.length === 0) return [];

  const [weeklyRules, monthlySlots, agendaSettings] = await Promise.all([
    prisma.availabilityRule.findMany({
      where: {
        tenant_id: input.tenantId,
        doctor_id: { in: input.doctorIds },
        OR: [
          { specific_date: null },
          {
            specific_date: {
              gte: input.from,
              lte: input.to,
            },
          },
        ],
      },
      select: {
        doctor_id: true,
        day_of_week: true,
        specific_date: true,
        start_time: true,
        end_time: true,
        slot_duration: true,
      },
      orderBy: [{ doctor_id: "asc" }, { day_of_week: "asc" }, { start_time: "asc" }],
    }),
    prisma.doctorAvailabilitySlot.findMany({
      where: {
        tenant_id: input.tenantId,
        doctor_id: { in: input.doctorIds },
        is_available: true,
        date: {
          gte: input.from,
          lte: input.to,
        },
      },
      select: {
        doctor_id: true,
        date: true,
        day_of_week: true,
        start_time: true,
        end_time: true,
      },
      orderBy: [{ doctor_id: "asc" }, { date: "asc" }, { start_time: "asc" }],
    }),
    prisma.agendaSettings.findMany({
      where: {
        tenant_id: input.tenantId,
        user_id: { in: input.doctorIds },
      },
      select: {
        user_id: true,
        appointment_duration: true,
      },
    }),
  ]);

  const durationByDoctor = new Map(agendaSettings.map((item) => [item.user_id, item.appointment_duration]));

  return [
    ...weeklyRules.map<ProfessionalAvailabilityBlock>((rule) => ({
      ...rule,
      source: rule.specific_date ? "specific_rule" : "weekly_rule",
    })),
    ...monthlySlots.map<ProfessionalAvailabilityBlock>((slot) => ({
      doctor_id: slot.doctor_id,
      day_of_week: slot.day_of_week,
      specific_date: slot.date,
      start_time: slot.start_time,
      end_time: slot.end_time,
      slot_duration: durationByDoctor.get(slot.doctor_id) ?? Math.max(10, parseTimeToMinutes(slot.end_time) - parseTimeToMinutes(slot.start_time)),
      source: "monthly_slot" as const,
    })),
  ];
}

export async function getProfessionalAvailability(
  professionalId: string,
  date: Date,
  options: ProfessionalAvailabilityOptions,
): Promise<ProfessionalAvailabilityBlock[]> {
  const targetDay = toUtcDateOnly(date);
  const rules = await getAvailabilityRulesForRangeResolved({
    tenantId: options.tenantId,
    doctorIds: [professionalId],
    from: targetDay,
    to: targetDay,
  });

  const matchingSpecific = rules.filter((rule) => rule.specific_date && dateKeyUtc(rule.specific_date) === dateKeyUtc(targetDay));
  if (matchingSpecific.length > 0) {
    return matchingSpecific.sort((left, right) => left.start_time.localeCompare(right.start_time));
  }

  return rules
    .filter((rule) => rule.specific_date === null && rule.day_of_week === targetDay.getUTCDay())
    .sort((left, right) => left.start_time.localeCompare(right.start_time));
}

export async function isProfessionalAvailable(
  professionalId: string,
  date: Date,
  startTime: string,
  endTime: string,
  options: ProfessionalAvailabilityOptions,
): Promise<boolean> {
  if (startTime >= endTime) return false;

  const blocks = await getProfessionalAvailability(professionalId, date, options);
  const covered = blocks.some((block) => block.start_time <= startTime && block.end_time >= endTime);
  if (!covered) return false;

  const dayStart = toUtcDateOnly(date);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const startAt = new Date(dayStart);
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  startAt.setUTCHours(startHours, startMinutes, 0, 0);

  const endAt = new Date(dayStart);
  const [endHours, endMinutes] = endTime.split(":").map(Number);
  endAt.setUTCHours(endHours, endMinutes, 0, 0);

  const overlapping = await prisma.appointment.findFirst({
    where: {
      tenant_id: options.tenantId,
      doctor_id: professionalId,
      deleted_at: null,
      status: { notIn: ["cancelled", "no_show"] },
      datetime: {
        gte: dayStart,
        lte: dayEnd,
      },
      ...(options.excludeAppointmentId ? { id: { not: options.excludeAppointmentId } } : {}),
    },
    select: {
      id: true,
      datetime: true,
      duration: true,
    },
    orderBy: { datetime: "asc" },
  });

  if (!overlapping) return true;

  const appointmentEnd = new Date(overlapping.datetime.getTime() + overlapping.duration * 60_000);
  return !(overlapping.datetime < endAt && appointmentEnd > startAt);
}