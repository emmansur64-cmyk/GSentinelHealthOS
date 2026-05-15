from . import review_reasons
from .review_policy import DEFAULT_REVIEW_POLICY
from .types import ConfidenceGateInput, ReviewEscalation, ReviewPolicy


def build_review_escalation(
    item: ConfidenceGateInput,
    reasons: list[str],
    policy: ReviewPolicy = DEFAULT_REVIEW_POLICY,
) -> ReviewEscalation:
    escalation_level = "routine"
    requires_specialist = False
    auto_blocked = False

    if item.risk_level in policy.specialist_risk_levels or item.target_specialty:
        escalation_level = "specialist"
        requires_specialist = True

    if item.risk_level == "critical" or review_reasons.HALLUCINATION_RISK in reasons:
        escalation_level = "urgent"

    if review_reasons.POLICY_BLOCK in reasons:
        escalation_level = "blocked"
        auto_blocked = True

    return ReviewEscalation(
        escalation_level=escalation_level,  # type: ignore[arg-type]
        escalation_reason=reasons,
        target_specialty=item.target_specialty,
        requires_specialist=requires_specialist,
        auto_blocked=auto_blocked,
    )
