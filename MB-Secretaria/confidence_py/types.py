from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

ConfidenceModality = Literal["text", "image", "multimodal", "unknown"]
ConfidenceRiskLevel = Literal["low", "medium", "high", "critical", "unknown"]
HallucinationRiskLevel = Literal["low", "medium", "high", "critical"]
ProviderOutputStatus = Literal["ok", "empty", "malformed", "error", "timeout"]


@dataclass(slots=True)
class ProviderOutputSummary:
    provider_name: str
    status: ProviderOutputStatus
    model_name: str | None = None
    content_summary: str | None = None
    confidence_score: float | None = None
    safety_flags: list[str] = field(default_factory=list)


@dataclass(slots=True)
class LayerSummary:
    available: bool
    summary: str | None = None
    confidence_score: float | None = None
    conflicts: list[str] = field(default_factory=list)
    quality_score: float | None = None


@dataclass(slots=True)
class RiskSummary(LayerSummary):
    risk_level: ConfidenceRiskLevel | None = None


@dataclass(slots=True)
class ClinicalConfidenceInput:
    trace_id: str
    tenant_id: str
    request_type: str
    modality: ConfidenceModality
    provider_outputs: list[ProviderOutputSummary]
    memory_context_summary: LayerSummary
    retrieval_summary: LayerSummary
    risk_summary: RiskSummary
    image_summary: LayerSummary | None = None
    review_status: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ProviderConsistencyResult:
    providers_compared: int
    consistency_score: float
    conflicts_detected: bool
    unresolved_conflicts: list[str]
    dominant_provider: str | None = None


@dataclass(slots=True)
class HallucinationRisk:
    risk_level: HallucinationRiskLevel
    unsupported_claims_detected: bool
    evidence_missing: bool
    multimodal_inconsistency: bool
    provider_divergence: bool
    escalation_required: bool


@dataclass(slots=True)
class EvidenceEvaluation:
    evidence_completeness: float
    missing_evidence: list[str]
    conflict_signals: list[str]


@dataclass(slots=True)
class MultimodalConflictResult:
    multimodal_conflict_detected: bool
    conflicts: list[str]


@dataclass(slots=True)
class SafeDisplayResult:
    safe_to_display: bool
    display_restrictions: list[str]
    unsafe_to_display: bool


@dataclass(slots=True)
class ClinicalConfidenceResult:
    trace_id: str
    confidence_score: float
    uncertainty_score: float
    hallucination_risk: HallucinationRisk
    evidence_completeness: float
    provider_consistency: ProviderConsistencyResult
    multimodal_conflict_detected: bool
    escalation_recommended: bool
    escalation_reason: list[str]
    safe_to_display: bool
    display_restrictions: list[str]
    confidence_explanation: list[str]
    audit_ref: str
    created_at: str


@dataclass(frozen=True, slots=True)
class ClinicalConfidenceFlags:
    enabled: bool = False
    shadow_mode: bool = True
    blocking_enabled: bool = False
    multimodal_enabled: bool = False
    provider_consistency_enabled: bool = True
    hallucination_check_enabled: bool = True
    safe_display_enabled: bool = False
    auto_escalation_enabled: bool = False


@dataclass(frozen=True, slots=True)
class ConfidencePolicy:
    minimum_safe_confidence: float = 0.65
    high_uncertainty_threshold: float = 0.7
    minimum_evidence_completeness: float = 0.55
    minimum_provider_consistency: float = 0.6
    high_hallucination_risk_threshold: float = 0.7


@dataclass(slots=True)
class ConfidenceAuditEvent:
    trace_id: str
    confidence_score: float
    uncertainty_score: float
    hallucination_risk: HallucinationRiskLevel
    escalation_recommended: bool
    safe_to_display: bool
    provider_conflicts: list[str]
    multimodal_conflicts: list[str]
    created_at: str
