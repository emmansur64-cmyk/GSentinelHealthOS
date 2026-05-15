from .types import ObservabilityEvent


def calculate_memory_metrics(events: list[ObservabilityEvent]) -> dict[str, int]:
    scoped = [event for event in events if event.layer == "memory"]
    return {
        "memory_event_count": len(scoped),
        "recall_count": len([event for event in scoped if "recall" in event.event_type]),
        "write_count": len([event for event in scoped if "remember" in event.event_type]),
        "fallback_count": len([event for event in scoped if "fallback" in event.event_type]),
    }
