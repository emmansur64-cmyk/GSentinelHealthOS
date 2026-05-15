import type { ProductionSafetyConfig } from "./types";

export function isDryRun(config: ProductionSafetyConfig): boolean {
  return config.dry_run || !config.ai_runtime_enabled;
}
