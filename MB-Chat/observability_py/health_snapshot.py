from datetime import UTC, datetime

from .confidence_metrics import calculate_confidence_metrics
from .drift_detector import detect_drift_signals
from .review_metrics import calculate_review_metrics
from .types import HealthSnapshot, ObservabilityEvent


def build_health_snapshot(events: list[ObservabilityEvent]) -> HealthSnapshot:
    drift = detect_drift_signals(events)
    confidence = calculate_confidence_metrics(events)
    review = calculate_review_metrics(events)
    degraded_layers = sorted({signal.layer for signal in drift if signal.severity in {"error", "critical"}})
    return HealthSnapshot(
        status="degraded" if degraded_layers else "unknown",
        providers=sorted({str(event.payload_summary.get("provider_name", "unknown")) for event in events if event.layer == "provider"}),
        confidence_health="degraded" if confidence.uncertainty_avg > 0.7 else "unknown",
        review_pressure="high" if review.pending_reviews > 10 else "medium" if review.pending_reviews > 3 else "low",
        escalation_pressure="high" if review.escalation_count > 10 else "medium" if review.escalation_count > 3 else "low",
        degraded_layers=degraded_layers,  # type: ignore[arg-type]
        drift_alerts=drift,
        created_at=datetime.now(UTC).isoformat(),
    )
