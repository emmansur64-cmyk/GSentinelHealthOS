import { readFlag } from "./global-feature-flags";
import { isKillSwitchActive } from "./kill-switch";
import type { ProductionLayer, ProductionSafetyConfig, RuntimeGuardResult } from "./types";

const LAYER_FLAG_MAP: Record<ProductionLayer, string> = {
  semantic_memory: "SEMANTIC_MEMORY_ENABLED",
  medical_vision: "MEDICAL_VISION_ENABLED",
  provider_router: "LLM_PROVIDER_ROUTER_ENABLED",
  human_review: "HUMAN_REVIEW_ENABLED",
  clinical_confidence: "CLINICAL_CONFIDENCE_ENABLED",
  observability: "OBSERVABILITY_ENABLED",
  production_safety: "AI_RUNTIME_ENABLED",
};

export function loadProductionSafetyConfig(env: NodeJS.ProcessEnv = process.env): ProductionSafetyConfig {
  const layers = Object.keys(LAYER_FLAG_MAP) as ProductionLayer[];
  const enabled_layers = layers.filter((layer) => readFlag(env, LAYER_FLAG_MAP[layer], "false"));
  return {
    ai_runtime_enabled: readFlag(env, "AI_RUNTIME_ENABLED", "false"),
    shadow_mode: readFlag(env, "AI_RUNTIME_SHADOW_MODE", "true"),
    dry_run: readFlag(env, "AI_RUNTIME_DRY_RUN", "true"),
    kill_switch: readFlag(env, "AI_RUNTIME_KILL_SWITCH", "true"),
    safe_fallback: readFlag(env, "AI_RUNTIME_SAFE_FALLBACK", "true"),
    blocking_enabled: readFlag(env, "AI_RUNTIME_BLOCKING_ENABLED", "false"),
    enabled_layers,
    disabled_layers: layers.filter((layer) => !enabled_layers.includes(layer)),
    external_calls_allowed: readFlag(env, "AI_RUNTIME_EXTERNAL_CALLS_ALLOWED", "false"),
    phi_allowed: readFlag(env, "AI_RUNTIME_PHI_ALLOWED", "false"),
    created_at: new Date().toISOString(),
  };
}

export function evaluateRuntimeGuard(config: ProductionSafetyConfig): RuntimeGuardResult {
  const blocked_reason: string[] = [];
  if (isKillSwitchActive(config)) blocked_reason.push("ai_runtime_kill_switch_or_disabled");
  if (config.blocking_enabled && !config.enabled_layers.includes("human_review")) blocked_reason.push("blocking_requires_human_review");
  if (config.external_calls_allowed && !config.phi_allowed) blocked_reason.push("external_calls_require_phi_policy");

  return {
    allowed: blocked_reason.length === 0 && config.ai_runtime_enabled && !config.kill_switch,
    blocked_reason,
    active_flags: {
      AI_RUNTIME_ENABLED: config.ai_runtime_enabled,
      AI_RUNTIME_SHADOW_MODE: config.shadow_mode,
      AI_RUNTIME_DRY_RUN: config.dry_run,
      AI_RUNTIME_KILL_SWITCH: config.kill_switch,
      AI_RUNTIME_SAFE_FALLBACK: config.safe_fallback,
      AI_RUNTIME_BLOCKING_ENABLED: config.blocking_enabled,
    },
    disabled_layers: config.disabled_layers,
    safe_fallback_required: !config.ai_runtime_enabled || config.kill_switch || config.safe_fallback,
    dry_run: config.dry_run,
    shadow_mode: config.shadow_mode,
    audit_ref: `production-safety:${config.created_at}`,
    created_at: new Date().toISOString(),
  };
}
