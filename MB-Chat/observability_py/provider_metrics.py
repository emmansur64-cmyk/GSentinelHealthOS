from .types import ObservabilityEvent, ProviderMetrics


def calculate_provider_metrics(provider_name: str, events: list[ObservabilityEvent]) -> ProviderMetrics:
    scoped = [event for event in events if event.layer == "provider" and event.payload_summary.get("provider_name") == provider_name]
    latencies = [float(event.payload_summary["latency_ms"]) for event in scoped if isinstance(event.payload_summary.get("latency_ms"), (int, float))]
    errors = [event for event in scoped if event.severity in {"error", "critical"}]
    return ProviderMetrics(
        provider_name=provider_name,
        request_count=len(scoped),
        timeout_count=len([event for event in scoped if "timeout" in event.event_type]),
        fallback_count=len([event for event in scoped if "fallback" in event.event_type]),
        latency_avg_ms=round(sum(latencies) / len(latencies)) if latencies else 0,
        degraded_mode_count=len([event for event in scoped if "degraded" in event.event_type]),
        error_rate=round(len(errors) / len(scoped), 3) if scoped else 0.0,
    )
