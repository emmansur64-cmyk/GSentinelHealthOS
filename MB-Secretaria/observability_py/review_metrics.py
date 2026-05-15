from .types import ObservabilityEvent, ReviewMetrics


def calculate_review_metrics(events: list[ObservabilityEvent]) -> ReviewMetrics:
    scoped = [event for event in events if event.layer == "review"]
    return ReviewMetrics(
        pending_reviews=len([event for event in scoped if event.payload_summary.get("status") == "PENDING_REVIEW"]),
        escalation_count=len([event for event in scoped if "escalation" in event.event_type]),
        override_count=len([event for event in scoped if "override" in event.event_type]),
        blocked_outputs=len([event for event in scoped if "blocked" in event.event_type]),
        specialist_required_count=len([event for event in scoped if event.payload_summary.get("status") == "REQUIRES_SPECIALIST"]),
    )
