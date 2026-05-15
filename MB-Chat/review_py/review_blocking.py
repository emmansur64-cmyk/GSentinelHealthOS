from __future__ import annotations

from dataclasses import dataclass

from . import review_reasons
from .types import ClinicalReviewCase, HumanReviewFlags


@dataclass(slots=True)
class BlockingResult:
    blocked: bool
    unsafe_to_display: bool
    requires_override: bool
    shadow_block_recommended: bool
    reason: list[str]


def evaluate_review_blocking(review_case: ClinicalReviewCase, flags: HumanReviewFlags) -> BlockingResult:
    unsafe_reason = (
        review_case.risk_level == "critical"
        or review_reasons.HALLUCINATION_RISK in review_case.review_reason
        or review_reasons.POLICY_BLOCK in review_case.review_reason
    )
    reasons = [review_reasons.POLICY_BLOCK] if unsafe_reason else []
    enforcement_active = flags.enabled and flags.blocking_enabled
    return BlockingResult(
        blocked=bool(enforcement_active and unsafe_reason),
        unsafe_to_display=bool(enforcement_active and unsafe_reason),
        requires_override=bool(unsafe_reason),
        shadow_block_recommended=bool(not enforcement_active and unsafe_reason),
        reason=reasons,
    )
