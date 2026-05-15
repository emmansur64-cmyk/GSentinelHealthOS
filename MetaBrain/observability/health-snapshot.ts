import { calculateConfidenceMetrics } from "./confidence-metrics";
import { detectDriftSignals } from "./drift-detector";
import { calculateReviewMetrics } from "./review-metrics";
import type { HealthSnapshot, ObservabilityEvent } from "./types";

export function buildHealthSnapshot(events: ObservabilityEvent[]): HealthSnapshot {
  const drift = detectDriftSignals(events);
  const confidence = calculateConfidenceMetrics(events);
  const review = calculateReviewMetrics(events);
  const degradedLayers = [...new Set(drift.filter((signal) => signal.severity === "error" || signal.severity === "critical").map((signal) => signal.layer))];
  return {
    status: degradedLayers.length ? "degraded" : "unknown",
    providers: [...new Set(events.filter((event) => event.layer === "provider").map((event) => String(event.payload_summary.provider_name ?? "unknown")))],
    confidence_health: confidence.uncertainty_avg > 0.7 ? "degraded" : "unknown",
    review_pressure: review.pending_reviews > 10 ? "high" : review.pending_reviews > 3 ? "medium" : "low",
    escalation_pressure: review.escalation_count > 10 ? "high" : review.escalation_count > 3 ? "medium" : "low",
    degraded_layers: degradedLayers,
    drift_alerts: drift,
    created_at: new Date().toISOString(),
  };
}
