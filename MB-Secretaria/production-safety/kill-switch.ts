import type { ProductionSafetyConfig } from "./types";

export function isKillSwitchActive(config: ProductionSafetyConfig): boolean {
  return config.kill_switch || !config.ai_runtime_enabled;
}
