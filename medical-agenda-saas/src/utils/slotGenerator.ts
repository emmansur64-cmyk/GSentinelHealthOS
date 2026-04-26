import type { NormalizedAiIntake } from "@/validators/aiSchema";

export type GeneratedSlot = {
  dayOfWeek: number;
  specificDate: Date;
  startTime: string;
  endTime: string;
  slotDuration: number;
};

export type SlotGenerationResult = {
  slots: GeneratedSlot[];
  skipped: number;
};

function toMinutes(time: string): number {
  const [hour, minute] = time.split(":").map((value) => Number(value));
  return hour * 60 + minute;
}

function toTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function toUtcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function slotKey(isoDate: string, startTime: string, endTime: string): string {
  return `${isoDate}|${startTime}|${endTime}`;
}

export function generateSlotsFromSchedule(
  schedule: NormalizedAiIntake["schedule"],
  slotDuration: number,
): SlotGenerationResult {
  const slots: GeneratedSlot[] = [];
  const inPayload = new Set<string>();
  let skipped = 0;

  for (const day of schedule) {
    const specificDate = toUtcDate(day.fecha);
    const dayOfWeek = specificDate.getUTCDay();

    for (const block of day.bloques) {
      const startMinutes = toMinutes(block.inicio);
      const endMinutes = toMinutes(block.fin);

      if (endMinutes <= startMinutes) {
        skipped += 1;
        continue;
      }

      let createdInBlock = 0;
      let cursor = startMinutes;
      while (cursor + slotDuration <= endMinutes) {
        const next = cursor + slotDuration;
        const startTime = toTime(cursor);
        const endTime = toTime(next);
        const key = slotKey(day.fecha, startTime, endTime);

        if (inPayload.has(key)) {
          skipped += 1;
        } else {
          inPayload.add(key);
          slots.push({
            dayOfWeek,
            specificDate,
            startTime,
            endTime,
            slotDuration,
          });
          createdInBlock += 1;
        }

        cursor = next;
      }

      if (createdInBlock === 0 || cursor < endMinutes) {
        skipped += 1;
      }
    }
  }

  return { slots, skipped };
}
