from .types import ClinicalConfidenceFlags, ConfidencePolicy, HallucinationRisk, SafeDisplayResult


def evaluate_safe_display(
    confidence_score: float,
    uncertainty_score: float,
    hallucination_risk: HallucinationRisk,
    escalation_recommended: bool,
    flags: ClinicalConfidenceFlags,
    policy: ConfidencePolicy,
) -> SafeDisplayResult:
    restrictions: list[str] = []
    if confidence_score < policy.minimum_safe_confidence:
        restrictions.append("safe_summary_only")
    if uncertainty_score >= policy.high_uncertainty_threshold:
        restrictions.append("explicit_uncertainty_required")
    if hallucination_risk.escalation_required:
        restrictions.append("human_review_recommended")
    unsafe = flags.safe_display_enabled and flags.blocking_enabled and escalation_recommended
    return SafeDisplayResult(safe_to_display=not unsafe, unsafe_to_display=unsafe, display_restrictions=restrictions)
