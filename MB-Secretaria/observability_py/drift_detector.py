from datetime import UTC, datetime

from .types import DriftSignal, ObservabilityEvent, ObservabilityLayer, ObservabilitySeverity


def _signal(layer: ObservabilityLayer, signal_type: str, severity: ObservabilitySeverity, description: str, events: list[ObservabilityEvent]) -> DriftSignal:
    return DriftSignal(layer, signal_type, severity, description, [event.trace_id for event in events[:10]], datetime.now(UTC).isoformat())


def detect_drift_signals(events: list[ObservabilityEvent]) -> list[DriftSignal]:
    signals: list[DriftSignal] = []
    fallbacks = [event for event in events if "fallback" in event.event_type]
    low_confidence = [event for event in events if event.layer == "confidence" and float(event.payload_summary.get("confidence_score", 1)) < 0.5]
    degraded = [event for event in events if event.layer == "provider" and "degraded" in event.event_type]
    review_escalations = [event for event in events if event.layer == "review" and "escalation" in event.event_type]
    multimodal = [event for event in events if "multimodal_conflict" in event.event_type]
    if len(fallbacks) >= 3:
        signals.append(_signal("system", "fallback_spike", "warn", "Fallback events are increasing.", fallbacks))
    if len(low_confidence) >= 3:
        signals.append(_signal("confidence", "low_confidence_spike", "warn", "Low confidence events are increasing.", low_confidence))
    if len(degraded) >= 2:
        signals.append(_signal("provider", "provider_degradation", "error", "Provider degraded events detected.", degraded))
    if len(review_escalations) >= 2:
        signals.append(_signal("review", "review_escalation_spike", "warn", "Human review escalation pressure increased.", review_escalations))
    if multimodal:
        signals.append(_signal("imaging", "multimodal_conflict", "warn", "Multimodal conflict signal detected.", multimodal))
    return signals
