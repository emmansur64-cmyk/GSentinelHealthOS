import type { ObservabilityAuditEvent, ObservabilityEvent } from "./types";

export function createObservabilityAuditEvent(trace_id: string, correlation_id: string, events: ObservabilityEvent[]): ObservabilityAuditEvent {
  const scoped = events.filter((event) => event.trace_id === trace_id);
  return {
    trace_id,
    correlation_id,
    layers_touched: [...new Set(scoped.map((event) => event.layer))],
    providers_involved: [...new Set(scoped.filter((event) => event.layer === "provider").map((event) => String(event.payload_summary.provider_name ?? "unknown")))],
    confidence_generated: scoped.some((event) => event.layer === "confidence"),
    review_triggered: scoped.some((event) => event.layer === "review"),
    escalated: scoped.some((event) => event.event_type.includes("escalation")),
    blocked: scoped.some((event) => event.event_type.includes("blocked")),
    created_at: new Date().toISOString(),
  };
}
