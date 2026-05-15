import type { MedicalWebRetrievalConfig, MedicalWebRetrievalMode } from "./types";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (typeof value !== "string") return defaultValue;
  return TRUE_VALUES.has(value.trim().toLowerCase());
}

function parseInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function parseMode(value: string | undefined): MedicalWebRetrievalMode {
  return value?.trim().toLowerCase() === "allowlist" ? "allowlist" : "allowlist";
}

export function getMedicalWebRetrievalConfig(): MedicalWebRetrievalConfig {
  return {
    enabled: parseBoolean(process.env.MEDICAL_WEB_RETRIEVAL_ENABLED, false),
    mode: parseMode(process.env.MEDICAL_WEB_RETRIEVAL_MODE),
    timeoutMs: parseInteger(process.env.MEDICAL_WEB_RETRIEVAL_TIMEOUT_MS, 8000, 1000, 30000),
    maxSources: parseInteger(process.env.MEDICAL_WEB_RETRIEVAL_MAX_SOURCES, 5, 1, 10),
  };
}
