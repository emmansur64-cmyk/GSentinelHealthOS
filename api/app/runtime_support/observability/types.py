from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

ObservabilitySeverity = Literal["debug", "info", "warn", "error", "critical"]
ObservabilityLayer = Literal[
    "provider",
    "memory",
    "imaging",
    "review",
    "confidence",
    "retrieval",
    "risk",
    "rules",
    "orchestrator",
    "audit",
    "system",
]


@dataclass(slots=True)
class TraceContext:
    trace_id: str
    correlation_id: str
    tenant_id: str
    request_type: str
    source_layer: str
    created_at: str
    parent_trace_id: str | None = None


@dataclass(slots=True)
class ObservabilityEvent:
    event_id: str
    trace_id: str
    correlation_id: str
    layer: ObservabilityLayer
    event_type: str
    severity: ObservabilitySeverity
    payload_summary: dict[str, Any]
    safety_flags: list[str]
    created_at: str


@dataclass(frozen=True, slots=True)
class ObservabilityFlags:
    enabled: bool = False
    shadow_mode: bool = True
    structured_logging_enabled: bool = False
    trace_engine_enabled: bool = False
    provider_metrics_enabled: bool = False
    confidence_metrics_enabled: bool = False
    review_metrics_enabled: bool = False
    multimodal_metrics_enabled: bool = False
    external_export_enabled: bool = False
    phi_allowed: bool = False
