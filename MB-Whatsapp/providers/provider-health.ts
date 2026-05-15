import type { ProviderAdapter, ProviderHealth, ProviderName } from "./types";

export function disabledProviderHealth(provider_name: ProviderName): ProviderHealth {
  return {
    provider_name,
    status: "disabled",
    latency_ms: 0,
    error_rate: 0,
    timeout_rate: 0,
    degraded_mode: true,
    checked_at: new Date().toISOString(),
  };
}

export async function checkProviderHealth(adapter: ProviderAdapter): Promise<ProviderHealth> {
  const started = Date.now();
  try {
    const health = await adapter.healthcheck();
    return { ...health, latency_ms: health.latency_ms || Date.now() - started };
  } catch {
    return {
      provider_name: adapter.provider_name,
      status: "unavailable",
      latency_ms: Date.now() - started,
      error_rate: 1,
      timeout_rate: 0,
      degraded_mode: true,
      checked_at: new Date().toISOString(),
    };
  }
}
