from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from .telemetry_sanitizer import sanitize_telemetry_payload
from .types import ObservabilityEvent, ObservabilityLayer, ObservabilitySeverity, TraceContext


def build_structured_log(
    trace: TraceContext,
    layer: ObservabilityLayer,
    event_type: str,
    severity: ObservabilitySeverity = "info",
    payload_summary: dict[str, Any] | None = None,
    safety_flags: list[str] | None = None,
) -> ObservabilityEvent:
    return ObservabilityEvent(
        event_id=f"evt_{uuid4()}",
        trace_id=trace.trace_id,
        correlation_id=trace.correlation_id,
        layer=layer,
        event_type=event_type,
        severity=severity,
        payload_summary=sanitize_telemetry_payload(payload_summary or {}),
        safety_flags=safety_flags or [],
        created_at=datetime.now(UTC).isoformat(),
    )
