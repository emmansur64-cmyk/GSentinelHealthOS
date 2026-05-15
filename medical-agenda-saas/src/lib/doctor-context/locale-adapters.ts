import { sanitizeDoctorContextString } from "./sanitizer";
import type { DoctorContextLocale } from "./types";

const DEFAULT_LOCALE: DoctorContextLocale = {
  country: "AR",
  region: null,
  language: "es-AR",
  timezone: "America/Argentina/Buenos_Aires",
};

export function buildLocaleContext(metadata?: Record<string, unknown> | null): DoctorContextLocale {
  const source = metadata?.doctor_context;
  const record = source && typeof source === "object" ? (source as Record<string, unknown>) : {};

  return {
    country: sanitizeDoctorContextString(record.country, 48) ?? DEFAULT_LOCALE.country,
    region: sanitizeDoctorContextString(record.region, 80),
    language: sanitizeDoctorContextString(record.language, 32) ?? DEFAULT_LOCALE.language,
    timezone: sanitizeDoctorContextString(record.timezone, 80) ?? DEFAULT_LOCALE.timezone,
  };
}
