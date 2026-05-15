from dataclasses import replace

from .types import ClinicalReviewCase, HumanReviewFlags, ReviewDecision, ReviewStatus


def status_from_decision(decision: ReviewDecision, flags: HumanReviewFlags) -> ReviewStatus:
    if decision.decision == "approve":
        return "APPROVED"
    if decision.decision == "reject":
        return "REJECTED"
    if decision.decision == "close":
        return "CLOSED"
    if decision.decision == "request_specialist":
        return "REQUIRES_SPECIALIST"
    if decision.decision == "override" and flags.override_enabled:
        return "OVERRIDDEN"
    if decision.decision == "override":
        return "ESCALATED"
    return "UNDER_REVIEW"


def apply_review_decision(
    review_case: ClinicalReviewCase,
    decision: ReviewDecision,
    flags: HumanReviewFlags,
) -> ClinicalReviewCase:
    return replace(review_case, status=status_from_decision(decision, flags), updated_at=decision.reviewed_at)
