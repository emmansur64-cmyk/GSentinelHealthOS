from .types import ObservabilityEvent


def calculate_performance_metrics(events: list[ObservabilityEvent]) -> dict[str, int]:
    latencies = [float(event.payload_summary["latency_ms"]) for event in events if isinstance(event.payload_summary.get("latency_ms"), (int, float))]
    return {
        "measured_events": len(latencies),
        "latency_avg_ms": round(sum(latencies) / len(latencies)) if latencies else 0,
        "timeout_count": len([event for event in events if "timeout" in event.event_type]),
    }
