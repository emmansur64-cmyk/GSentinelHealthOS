from .types import ObservabilityEvent, RequestLineage


def build_request_lineage(trace_id: str, events: list[ObservabilityEvent]) -> RequestLineage:
    scoped = [event for event in events if event.trace_id == trace_id]
    return RequestLineage(
        trace_id=trace_id,
        providers_used=sorted({str(event.payload_summary.get("provider_name", "unknown")) for event in scoped if event.layer == "provider"}),
        memory_accessed=any(event.layer == "memory" for event in scoped),
        imaging_used=any(event.layer == "imaging" for event in scoped),
        review_triggered=any(event.layer == "review" for event in scoped),
        confidence_generated=any(event.layer == "confidence" for event in scoped),
        escalations=[event.event_type for event in scoped if "escalation" in event.event_type],
        fallbacks=[event.event_type for event in scoped if "fallback" in event.event_type],
        blocked_outputs=[event.event_type for event in scoped if "blocked" in event.event_type],
        final_status=scoped[-1].event_type if scoped else "unknown",
    )
