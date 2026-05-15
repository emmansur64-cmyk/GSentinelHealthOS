import type { ProductionSafetyConfig } from "./types";

export function isShadowMode(config: ProductionSafetyConfig): boolean {
  return config.shadow_mode || !config.ai_runtime_enabled;
}
