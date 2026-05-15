import type { ObservabilityEvent, ProviderMetrics } from "./types";

export function calculateProviderMetrics(provider_name: string, events: ObservabilityEvent[]): ProviderMetrics {
  const providerEvents = events.filter((event) => event.layer === "provider" && event.payload_summary.provider_name === provider_name);
  const requestCount = providerEvents.length;
  const timeoutCount = providerEvents.filter((event) => event.event_type.includes("timeout")).length;
  const fallbackCount = providerEvents.filter((event) => event.event_type.includes("fallback")).length;
  const errorCount = providerEvents.filter((event) => event.severity === "error" || event.severity === "critical").length;
  const latencies = providerEvents.map((event) => Number(event.payload_summary.latency_ms)).filter(Number.isFinite);
  return {
    provider_name,
    request_count: requestCount,
    timeout_count: timeoutCount,
    fallback_count: fallbackCount,
    latency_avg_ms: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : 0,
    degraded_mode_count: providerEvents.filter((event) => event.event_type.includes("degraded")).length,
    error_rate: requestCount ? Number((errorCount / requestCount).toFixed(3)) : 0,
  };
}
