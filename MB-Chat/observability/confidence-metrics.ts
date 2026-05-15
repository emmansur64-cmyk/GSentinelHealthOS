import type { ConfidenceMetrics, ObservabilityEvent } from "./types";

function average(values: number[]): number {
  return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3)) : 0;
}

export function calculateConfidenceMetrics(events: ObservabilityEvent[]): ConfidenceMetrics {
  const scoped = events.filter((event) => event.layer === "confidence");
  const confidence = scoped.map((event) => Number(event.payload_summary.confidence_score)).filter(Number.isFinite);
  const uncertainty = scoped.map((event) => Number(event.payload_summary.uncertainty_score)).filter(Number.isFinite);
  return {
    confidence_avg: average(confidence),
    uncertainty_avg: average(uncertainty),
    hallucination_flags: scoped.filter((event) => String(event.payload_summary.hallucination_risk ?? "").match(/high|critical/)).length,
    escalation_rate: scoped.length ? Number((scoped.filter((event) => event.event_type.includes("escalation")).length / scoped.length).toFixed(3)) : 0,
    safe_display_rate: scoped.length ? Number((scoped.filter((event) => event.payload_summary.safe_to_display === true).length / scoped.length).toFixed(3)) : 0,
  };
}
