import type { HealthCheckResult, ProductionLayer, ProductionSafetyConfig } from "./types";

export function buildLayerHealth(layer: ProductionLayer, config: ProductionSafetyConfig): HealthCheckResult {
  const enabled = config.enabled_layers.includes(layer);
  const warnings: string[] = [];
  if (enabled && config.kill_switch) warnings.push("enabled_layer_blocked_by_global_kill_switch");
  if (enabled && config.dry_run) warnings.push("enabled_layer_would_run_dry_run_only");
  return {
    layer,
    status: !enabled ? "disabled" : config.kill_switch ? "blocked" : config.dry_run ? "dry_run" : config.shadow_mode ? "shadow" : "warning",
    enabled,
    shadow_mode: config.shadow_mode,
    degraded: warnings.length > 0,
    errors: [],
    warnings,
    checked_at: new Date().toISOString(),
  };
}

export function buildProductionSafetyHealth(config: ProductionSafetyConfig): HealthCheckResult[] {
  return (["semantic_memory", "medical_vision", "provider_router", "human_review", "clinical_confidence", "observability", "production_safety"] as ProductionLayer[]).map((layer) =>
    buildLayerHealth(layer, config),
  );
}
