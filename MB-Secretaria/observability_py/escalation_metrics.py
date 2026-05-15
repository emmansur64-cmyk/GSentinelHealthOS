from .types import ObservabilityEvent


def calculate_escalation_metrics(events: list[ObservabilityEvent]) -> dict[str, int]:
    scoped = [event for event in events if "escalation" in event.event_type]
    return {
        "escalation_count": len(scoped),
        "human_review_escalations": len([event for event in scoped if event.layer == "review"]),
        "confidence_escalations": len([event for event in scoped if event.layer == "confidence"]),
        "critical_escalations": len([event for event in scoped if event.severity == "critical"]),
    }
