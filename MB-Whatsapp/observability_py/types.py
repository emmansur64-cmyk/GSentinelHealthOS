from __future__ import annotations

from dataclasses import dataclass, field
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


@dataclass(slots=True)
class RequestLineage:
    trace_id: str
    providers_used: list[str]
    memory_accessed: bool
    imaging_used: bool
    review_triggered: bool
    confidence_generated: bool
    escalations: list[str]
    fallbacks: list[str]
    blocked_outputs: list[str]
    final_status: str


@dataclass(slots=True)
class ProviderMetrics:
    provider_name: str
    request_count: int
    timeout_count: int
    fallback_count: int
    latency_avg_ms: int
    degraded_mode_count: int
    error_rate: float


@dataclass(slots=True)
class ConfidenceMetrics:
    confidence_avg: float
    uncertainty_avg: float
    hallucination_flags: int
    escalation_rate: float
    safe_display_rate: float


@dataclass(slots=True)
class ReviewMetrics:
    pending_reviews: int
    escalation_count: int
    override_count: int
    blocked_outputs: int
    specialist_required_count: int


@dataclass(slots=True)
class DriftSignal:
    layer: ObservabilityLayer
    signal_type: str
    severity: ObservabilitySeverity
    description: str
    trace_refs: list[str]
    detected_at: str


@dataclass(slots=True)
class ObservabilityAuditEvent:
    trace_id: str
    correlation_id: str
    layers_touched: list[ObservabilityLayer]
    providers_involved: list[str]
    confidence_generated: bool
    review_triggered: bool
    escalated: bool
    blocked: bool
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


@dataclass(slots=True)
class HealthSnapshot:
    status: Literal["healthy", "degraded", "critical", "unknown"]
    providers: list[str]
    confidence_health: Literal["ok", "degraded", "unknown"]
    review_pressure: Literal["low", "medium", "high"]
    escalation_pressure: Literal["low", "medium", "high"]
    degraded_layers: list[ObservabilityLayer]
    drift_alerts: list[DriftSignal]
    created_at: str
