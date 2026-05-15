from dataclasses import dataclass

from .types import ConfidencePolicy, HallucinationRisk


@dataclass(slots=True)
class EscalationRecommendation:
    escalation_recommended: bool
    escalation_reason: list[str]


def build_escalation_recommendation(
    confidence_score: float,
    uncertainty_score: float,
    hallucination_risk: HallucinationRisk,
    evidence_completeness: float,
    provider_conflicts: list[str],
    multimodal_conflicts: list[str],
    policy: ConfidencePolicy,
) -> EscalationRecommendation:
    reasons: list[str] = []
    if confidence_score < policy.minimum_safe_confidence:
        reasons.append("confidence_below_safe_threshold")
    if uncertainty_score >= policy.high_uncertainty_threshold:
        reasons.append("high_uncertainty")
    if evidence_completeness < policy.minimum_evidence_completeness:
        reasons.append("insufficient_evidence")
    if hallucination_risk.escalation_required:
        reasons.append(f"hallucination_risk_{hallucination_risk.risk_level}")
    if provider_conflicts:
        reasons.append("provider_conflict")
    if multimodal_conflicts:
        reasons.append("multimodal_conflict")
    return EscalationRecommendation(bool(reasons), reasons)
