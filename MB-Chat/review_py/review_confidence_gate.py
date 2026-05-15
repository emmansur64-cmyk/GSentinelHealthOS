from __future__ import annotations

from dataclasses import dataclass

from . import review_reasons
from .review_escalation import build_review_escalation
from .review_policy import DEFAULT_REVIEW_POLICY
from .types import ConfidenceGateInput, HumanReviewFlags, ReviewEscalation, ReviewPolicy


@dataclass(slots=True)
class ConfidenceGateResult:
    requires_review: bool
    would_require_review: bool
    review_reason: list[str]
    escalation: ReviewEscalation
    blocked: bool
    unsafe_to_display: bool
    shadow_mode: bool


def evaluate_confidence_gate(
    item: ConfidenceGateInput,
    flags: HumanReviewFlags,
    policy: ReviewPolicy = DEFAULT_REVIEW_POLICY,
) -> ConfidenceGateResult:
    reasons: list[str] = []
    confidence = item.confidence_score if item.confidence_score is not None else 0.0
    uncertainty = item.uncertainty_score if item.uncertainty_score is not None else 1.0

    if flags.low_confidence_required and confidence < policy.low_confidence_threshold:
        reasons.append(review_reasons.LOW_CONFIDENCE)
    if uncertainty >= policy.high_uncertainty_threshold:
        reasons.append(review_reasons.HIGH_UNCERTAINTY)
    if flags.image_required and item.modality == "image":
        reasons.append(review_reasons.IMAGE_REVIEW_REQUIRED)
    if flags.multimodal_required and item.modality == "multimodal":
        reasons.append(review_reasons.MULTIMODAL_REVIEW_REQUIRED)
    if flags.high_risk_required and item.risk_level in policy.high_risk_levels:
        reasons.append(review_reasons.HIGH_RISK_REVIEW_REQUIRED)
    if item.provider_conflict:
        reasons.append(review_reasons.PROVIDER_CONFLICT)
    if item.hallucination_risk:
        reasons.append(review_reasons.HALLUCINATION_RISK)

    active_reasons = reasons if flags.enabled else [review_reasons.HUMAN_REVIEW_DISABLED, *reasons]
    escalation = build_review_escalation(item, active_reasons, policy)
    block_recommended = review_reasons.HALLUCINATION_RISK in active_reasons or item.risk_level == "critical"

    return ConfidenceGateResult(
        requires_review=bool(flags.enabled and reasons),
        would_require_review=bool(reasons),
        review_reason=active_reasons,
        escalation=escalation,
        blocked=bool(flags.enabled and flags.blocking_enabled and block_recommended),
        unsafe_to_display=bool(flags.enabled and flags.blocking_enabled and block_recommended),
        shadow_mode=flags.shadow_mode,
    )
