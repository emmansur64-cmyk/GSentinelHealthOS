export const GLOBAL_AI_FLAGS_DEFAULTS: Record<string, string> = {
  AI_RUNTIME_ENABLED: "false",
  AI_RUNTIME_SHADOW_MODE: "true",
  AI_RUNTIME_DRY_RUN: "true",
  AI_RUNTIME_KILL_SWITCH: "true",
  AI_RUNTIME_SAFE_FALLBACK: "true",
  AI_RUNTIME_BLOCKING_ENABLED: "false",
  SEMANTIC_MEMORY_ENABLED: "false",
  MEDICAL_VISION_ENABLED: "false",
  LLM_PROVIDER_ROUTER_ENABLED: "false",
  HUMAN_REVIEW_ENABLED: "false",
  CLINICAL_CONFIDENCE_ENABLED: "false",
  OBSERVABILITY_ENABLED: "false",
};

export const EXPECTED_GLOBAL_AI_FLAGS = Object.keys(GLOBAL_AI_FLAGS_DEFAULTS);

export function readFlag(env: NodeJS.ProcessEnv, name: string, fallback: string = "false"): boolean {
  return String(env[name] ?? fallback).trim().toLowerCase() === "true";
}
