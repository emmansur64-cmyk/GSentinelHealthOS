import type { ProviderHealth } from "../types";

export function futureMedicalHealthDisabled(): ProviderHealth {
  return {
    provider_name: "future-medical",
    status: "disabled",
    latency_ms: 0,
    error_rate: 0,
    timeout_rate: 0,
    degraded_mode: true,
    checked_at: new Date().toISOString(),
  };
}
