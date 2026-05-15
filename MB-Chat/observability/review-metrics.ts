import type { ObservabilityEvent, ReviewMetrics } from "./types";

export function calculateReviewMetrics(events: ObservabilityEvent[]): ReviewMetrics {
  const scoped = events.filter((event) => event.layer === "review");
  return {
    pending_reviews: scoped.filter((event) => event.payload_summary.status === "PENDING_REVIEW").length,
    escalation_count: scoped.filter((event) => event.event_type.includes("escalation")).length,
    override_count: scoped.filter((event) => event.event_type.includes("override")).length,
    blocked_outputs: scoped.filter((event) => event.event_type.includes("blocked")).length,
    specialist_required_count: scoped.filter((event) => event.payload_summary.status === "REQUIRES_SPECIALIST").length,
  };
}
