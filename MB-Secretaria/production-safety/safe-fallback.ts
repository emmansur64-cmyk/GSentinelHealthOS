import type { RuntimeGuardResult } from "./types";

export function buildSafeFallback(reason: string[], guard?: Partial<RuntimeGuardResult>) {
  return {
    fallback_required: true,
    reason,
    action: "continue_existing_runtime_flow",
    blocks_critical_apis: false,
    dry_run: guard?.dry_run ?? true,
    shadow_mode: guard?.shadow_mode ?? true,
  };
}
