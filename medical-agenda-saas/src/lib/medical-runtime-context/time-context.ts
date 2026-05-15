import type { MedicalRuntimeTimeContext } from "./types";

function getParts(date: Date, timezone: string): Record<string, string> {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
}

function getSeason(month: number, hemisphere: "north" | "south"): MedicalRuntimeTimeContext["season"] {
  const south = hemisphere === "south";
  if ([12, 1, 2].includes(month)) return south ? "summer" : "winter";
  if ([3, 4, 5].includes(month)) return south ? "autumn" : "spring";
  if ([6, 7, 8].includes(month)) return south ? "winter" : "summer";
  return south ? "spring" : "autumn";
}

export function buildTimeContext(timezone: string, latitude: number | null): MedicalRuntimeTimeContext {
  const now = new Date();
  let safeTimezone = timezone;
  let parts: Record<string, string>;
  try {
    parts = getParts(now, safeTimezone);
  } catch {
    safeTimezone = "UTC";
    parts = getParts(now, safeTimezone);
  }
  const hour = Number(parts.hour ?? "0");
  const month = Number(parts.month ?? "1");
  const isNightShift = hour >= 20 || hour < 7;
  const season = getSeason(month, latitude !== null && latitude < 0 ? "south" : "north");

  return {
    timestamp: now.toISOString(),
    timezone: safeTimezone,
    localDate: `${parts.year}-${parts.month}-${parts.day}`,
    localTime: `${parts.hour}:${parts.minute}`,
    dayOfWeek: parts.weekday ?? "",
    isNightShift,
    season,
    temporalContext: isNightShift ? "night_shift_or_low_staffing_hours" : "daytime_or_standard_clinic_hours",
  };
}
