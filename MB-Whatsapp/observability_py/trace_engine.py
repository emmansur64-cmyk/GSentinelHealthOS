from typing import Any

from .event_bus import InMemoryObservabilityEventBus
from .request_lineage import build_request_lineage
from .structured_logger import build_structured_log
from .trace_context import create_trace_context
from .types import ObservabilityEvent, ObservabilityLayer, ObservabilitySeverity, RequestLineage, TraceContext


class TraceEngine:
    def __init__(self, event_bus: InMemoryObservabilityEventBus | None = None) -> None:
        self.event_bus = event_bus or InMemoryObservabilityEventBus()

    def start_trace(self, tenant_id: str, request_type: str, source_layer: str, parent_trace_id: str | None = None) -> TraceContext:
        return create_trace_context(tenant_id, request_type, source_layer, parent_trace_id)

    def record(
        self,
        trace: TraceContext,
        layer: ObservabilityLayer,
        event_type: str,
        severity: ObservabilitySeverity = "info",
        payload_summary: dict[str, Any] | None = None,
        safety_flags: list[str] | None = None,
    ) -> ObservabilityEvent:
        event = build_structured_log(trace, layer, event_type, severity, payload_summary, safety_flags)
        self.event_bus.publish(event)
        return event

    def events(self) -> list[ObservabilityEvent]:
        return self.event_bus.list()

    def lineage(self, trace_id: str) -> RequestLineage:
        return build_request_lineage(trace_id, self.events())
