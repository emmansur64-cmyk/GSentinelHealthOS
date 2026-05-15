from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


ReviewStatus = Literal[
    "PENDING_REVIEW",
    "UNDER_REVIEW",
    "ESCALATED",
    "APPROVED",
    "REJECTED",
    "OVERRIDDEN",
    "AUTO_BLOCKED",
    "REQUIRES_SPECIALIST",
    "CLOSED",
]
ReviewRiskLevel = Literal["low", "medium", "high", "critical", "unknown"]
ReviewModality = Literal["text", "image", "multimodal", "unknown"]
EscalationLevel = Literal["none", "routine", "urgent", "specialist", "blocked"]


@dataclass(slots=True)
class ClinicalReviewCase:
    review_id: str
    trace_id: str
    tenant_id: str
    source_layer: str
    request_type: str
    modality: ReviewModality
    risk_level: ReviewRiskLevel
    confidence_score: float
    uncertainty_score: float
    requires_review: bool
    review_reason: list[str]
    ai_output_summary: str
    provider: str
    escalation_level: EscalationLevel
    status: ReviewStatus
    created_at: str
    updated_at: str
    doctor_id: str | None = None
    patient_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ReviewDecision:
    reviewer_id: str
    decision: Literal["approve", "reject", "override", "close", "request_specialist"]
    notes: str
    reviewed_at: str
    override_reason: str | None = None


@dataclass(slots=True)
class ReviewEscalation:
    escalation_level: EscalationLevel
    escalation_reason: list[str]
    requires_specialist: bool
    auto_blocked: bool
    target_specialty: str | None = None


@dataclass(slots=True)
class ReviewAuditEvent:
    review_id: str
    trace_id: str
    status_after: ReviewStatus
    escalation_level: EscalationLevel
    override_used: bool
    blocked: bool
    created_at: str
    reviewer_id: str | None = None
    status_before: ReviewStatus | None = None


@dataclass(frozen=True, slots=True)
class HumanReviewFlags:
    enabled: bool = False
    shadow_mode: bool = True
    blocking_enabled: bool = False
    image_required: bool = True
    low_confidence_required: bool = True
    multimodal_required: bool = True
    high_risk_required: bool = True
    override_enabled: bool = False


@dataclass(frozen=True, slots=True)
class ReviewPolicy:
    low_confidence_threshold: float = 0.6
    high_uncertainty_threshold: float = 0.7
    high_risk_levels: tuple[ReviewRiskLevel, ...] = ("high", "critical")
    specialist_risk_levels: tuple[ReviewRiskLevel, ...] = ("critical",)


@dataclass(slots=True)
class ConfidenceGateInput:
    trace_id: str
    tenant_id: str
    source_layer: str
    request_type: str
    modality: ReviewModality
    risk_level: ReviewRiskLevel
    doctor_id: str | None = None
    patient_id: str | None = None
    confidence_score: float | None = None
    uncertainty_score: float | None = None
    provider: str | None = None
    ai_output_summary: str | None = None
    provider_conflict: bool = False
    hallucination_risk: bool = False
    target_specialty: str | None = None
