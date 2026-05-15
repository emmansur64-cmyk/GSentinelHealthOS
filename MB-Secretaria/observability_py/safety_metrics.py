from .types import ObservabilityEvent


def calculate_safety_metrics(events: list[ObservabilityEvent]) -> dict[str, int]:
    return {
        "safety_event_count": len([event for event in events if event.safety_flags]),
        "phi_redaction_count": len([event for event in events if "phi_redacted" in event.safety_flags]),
        "unsafe_to_display_count": len([event for event in events if event.payload_summary.get("unsafe_to_display") is True]),
        "blocked_output_count": len([event for event in events if "blocked" in event.event_type]),
    }
