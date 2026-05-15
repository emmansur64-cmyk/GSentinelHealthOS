import type { ObservabilityEvent, RequestLineage } from "./types";

export function buildRequestLineage(trace_id: string, events: ObservabilityEvent[]): RequestLineage {
  const scoped = events.filter((event) => event.trace_id === trace_id);
  return {
    trace_id,
    providers_used: [...new Set(scoped.filter((event) => event.layer === "provider").map((event) => String(event.payload_summary.provider_name ?? "unknown")))],
    memory_accessed: scoped.some((event) => event.layer === "memory"),
    imaging_used: scoped.some((event) => event.layer === "imaging"),
    review_triggered: scoped.some((event) => event.layer === "review"),
    confidence_generated: scoped.some((event) => event.layer === "confidence"),
    escalations: scoped.filter((event) => event.event_type.includes("escalation")).map((event) => event.event_type),
    fallbacks: scoped.filter((event) => event.event_type.includes("fallback")).map((event) => event.event_type),
    blocked_outputs: scoped.filter((event) => event.event_type.includes("blocked")).map((event) => event.event_type),
    final_status: scoped.at(-1)?.event_type ?? "unknown",
  };
}
