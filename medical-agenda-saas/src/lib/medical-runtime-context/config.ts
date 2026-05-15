import type { MedicalRuntimeContextConfig } from "./types";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return fallback;
}

function parseInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function parseCoordinate(value: string | undefined, min: number, max: number): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return Number(parsed.toFixed(2));
}

function normalizeOptional(value: string | undefined, max = 80): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.replace(/[^\p{L}\p{N}\s.,_-]/gu, "").slice(0, max).trim() || null;
}

export function getMedicalRuntimeContextConfig(): MedicalRuntimeContextConfig {
  return {
    enabled: parseBoolean(process.env.MEDICAL_RUNTIME_CONTEXT_ENABLED, false),
    weatherEnabled: parseBoolean(process.env.MEDICAL_RUNTIME_CONTEXT_WEATHER_ENABLED, true),
    alertsEnabled: parseBoolean(process.env.MEDICAL_RUNTIME_CONTEXT_ALERTS_ENABLED, true),
    cacheTtlSeconds: parseInteger(process.env.MEDICAL_RUNTIME_CONTEXT_CACHE_TTL_SECONDS, 900, 30, 86_400),
    timeoutMs: parseInteger(process.env.MEDICAL_RUNTIME_CONTEXT_TIMEOUT_MS, 5000, 500, 30_000),
    timezone: normalizeOptional(process.env.MEDICAL_RUNTIME_CONTEXT_TIMEZONE, 64) ?? "America/Argentina/Buenos_Aires",
    region: normalizeOptional(process.env.MEDICAL_RUNTIME_CONTEXT_REGION, 80),
    latitude: parseCoordinate(process.env.MEDICAL_RUNTIME_CONTEXT_LATITUDE, -90, 90),
    longitude: parseCoordinate(process.env.MEDICAL_RUNTIME_CONTEXT_LONGITUDE, -180, 180),
  };
}

