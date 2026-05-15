import type { ObservabilityEvent } from "./types";

export function calculatePerformanceMetrics(events: ObservabilityEvent[]) {
  const latencies = events.map((event) => Number(event.payload_summary.latency_ms)).filter(Number.isFinite);
  return {
    measured_events: latencies.length,
    latency_avg_ms: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : 0,
    timeout_count: events.filter((event) => event.event_type.includes("timeout")).length,
  };
}
