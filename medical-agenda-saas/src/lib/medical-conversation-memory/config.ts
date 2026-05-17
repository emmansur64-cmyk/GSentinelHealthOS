import type { MedicalConversationMemoryConfig } from "./types";

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

export function getMedicalConversationMemoryConfig(): MedicalConversationMemoryConfig {
  return {
    enabled: parseBoolean(process.env.MEDICAL_CONVERSATION_MEMORY_ENABLED, true),
    maxExchanges: parseInteger(process.env.MEDICAL_CONVERSATION_MEMORY_MAX_EXCHANGES, 24, 1, 120),
    maxSummaryChars: parseInteger(process.env.MEDICAL_CONVERSATION_MEMORY_MAX_SUMMARY_CHARS, 3200, 400, 10000),
    ttlHours: parseInteger(process.env.MEDICAL_CONVERSATION_MEMORY_TTL_HOURS, 72, 1, 720),
    maxMedicationMentions: parseInteger(process.env.MEDICAL_CONVERSATION_MEMORY_MAX_MEDICATIONS, 8, 0, 20),
    maxHypotheses: parseInteger(process.env.MEDICAL_CONVERSATION_MEMORY_MAX_HYPOTHESES, 8, 0, 20),
    maxDecisions: parseInteger(process.env.MEDICAL_CONVERSATION_MEMORY_MAX_DECISIONS, 8, 0, 20),
  };
}
