import { EXPECTED_GLOBAL_AI_FLAGS, GLOBAL_AI_FLAGS_DEFAULTS, readFlag } from "./global-feature-flags";
import type { EnvValidationResult } from "./types";

export function validateProductionEnv(env: NodeJS.ProcessEnv = process.env): EnvValidationResult {
  const missing_flags = EXPECTED_GLOBAL_AI_FLAGS.filter((flag) => env[flag] === undefined);
  const dangerous_flags: string[] = [];
  const warnings: string[] = [];

  if (readFlag(env, "AI_RUNTIME_ENABLED", GLOBAL_AI_FLAGS_DEFAULTS.AI_RUNTIME_ENABLED) && !readFlag(env, "AI_RUNTIME_KILL_SWITCH", "true")) {
    dangerous_flags.push("ai_runtime_enabled_without_kill_switch");
  }
  if (readFlag(env, "MEDICAL_VISION_ENABLED", "false") && !readFlag(env, "HUMAN_REVIEW_ENABLED", "false")) {
    dangerous_flags.push("medical_vision_without_human_review");
  }
  if (readFlag(env, "CLINICAL_CONFIDENCE_BLOCKING_ENABLED", "false") && !readFlag(env, "HUMAN_REVIEW_ENABLED", "false")) {
    dangerous_flags.push("confidence_blocking_without_review");
  }
  if (readFlag(env, "OBSERVABILITY_EXTERNAL_EXPORT_ENABLED", "false") && readFlag(env, "OBSERVABILITY_PHI_ALLOWED", "false")) {
    dangerous_flags.push("observability_export_with_phi_allowed");
  }
  if (missing_flags.length > 0) warnings.push("expected_flags_missing_but_defaults_are_safe");

  return { ok: dangerous_flags.length === 0, missing_flags, dangerous_flags, warnings, checked_at: new Date().toISOString() };
}
