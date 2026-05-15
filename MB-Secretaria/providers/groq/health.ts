import type { ProviderHealth } from "../types";

export function groqHealthDisabled(): ProviderHealth {
  return {
    provider_name: "groq",
    status: "disabled",
    latency_ms: 0,
    error_rate: 0,
    timeout_rate: 0,
    degraded_mode: true,
    checked_at: new Date().toISOString(),
  };
}
