import type { ObservabilityEvent } from "./types";

export function calculateEscalationMetrics(events: ObservabilityEvent[]) {
  const escalationEvents = events.filter((event) => event.event_type.includes("escalation"));
  return {
    escalation_count: escalationEvents.length,
    human_review_escalations: escalationEvents.filter((event) => event.layer === "review").length,
    confidence_escalations: escalationEvents.filter((event) => event.layer === "confidence").length,
    critical_escalations: escalationEvents.filter((event) => event.severity === "critical").length,
  };
}
