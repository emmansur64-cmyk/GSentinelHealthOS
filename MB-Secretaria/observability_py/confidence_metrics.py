from .types import ConfidenceMetrics, ObservabilityEvent


def _avg(values: list[float]) -> float:
    return round(sum(values) / len(values), 3) if values else 0.0


def calculate_confidence_metrics(events: list[ObservabilityEvent]) -> ConfidenceMetrics:
    scoped = [event for event in events if event.layer == "confidence"]
    confidence = [float(event.payload_summary["confidence_score"]) for event in scoped if isinstance(event.payload_summary.get("confidence_score"), (int, float))]
    uncertainty = [float(event.payload_summary["uncertainty_score"]) for event in scoped if isinstance(event.payload_summary.get("uncertainty_score"), (int, float))]
    return ConfidenceMetrics(
        confidence_avg=_avg(confidence),
        uncertainty_avg=_avg(uncertainty),
        hallucination_flags=len([event for event in scoped if str(event.payload_summary.get("hallucination_risk", "")) in {"high", "critical"}]),
        escalation_rate=round(len([event for event in scoped if "escalation" in event.event_type]) / len(scoped), 3) if scoped else 0.0,
        safe_display_rate=round(len([event for event in scoped if event.payload_summary.get("safe_to_display") is True]) / len(scoped), 3) if scoped else 0.0,
    )
