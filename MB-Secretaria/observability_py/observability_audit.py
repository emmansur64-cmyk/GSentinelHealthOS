from datetime import UTC, datetime

from .types import ObservabilityAuditEvent, ObservabilityEvent


def create_observability_audit_event(trace_id: str, correlation_id: str, events: list[ObservabilityEvent]) -> ObservabilityAuditEvent:
    scoped = [event for event in events if event.trace_id == trace_id]
    return ObservabilityAuditEvent(
        trace_id=trace_id,
        correlation_id=correlation_id,
        layers_touched=sorted({event.layer for event in scoped}),  # type: ignore[arg-type]
        providers_involved=sorted({str(event.payload_summary.get("provider_name", "unknown")) for event in scoped if event.layer == "provider"}),
        confidence_generated=any(event.layer == "confidence" for event in scoped),
        review_triggered=any(event.layer == "review" for event in scoped),
        escalated=any("escalation" in event.event_type for event in scoped),
        blocked=any("blocked" in event.event_type for event in scoped),
        created_at=datetime.now(UTC).isoformat(),
    )
