from .types import ObservabilityEvent


def calculate_imaging_metrics(events: list[ObservabilityEvent]) -> dict[str, int]:
    scoped = [event for event in events if event.layer == "imaging"]
    return {
        "image_event_count": len(scoped),
        "human_review_required_count": len([event for event in scoped if event.payload_summary.get("requires_human_review") is True]),
        "metadata_only_count": len([event for event in scoped if event.payload_summary.get("legacy_metadata_only") is True]),
        "unsafe_payload_count": len([event for event in scoped if "unsafe_image_payload" in event.safety_flags]),
    }
