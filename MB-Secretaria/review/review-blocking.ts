import { REVIEW_REASONS } from "./review-reasons";
import type { BlockingResult, ClinicalReviewCase, HumanReviewFlags } from "./types";

export function evaluateReviewBlocking(reviewCase: ClinicalReviewCase, flags: HumanReviewFlags): BlockingResult {
  const reason: string[] = [];
  const highRisk = reviewCase.risk_level === "critical";
  const unsafeReason =
    highRisk ||
    reviewCase.review_reason.includes(REVIEW_REASONS.HALLUCINATION_RISK) ||
    reviewCase.review_reason.includes(REVIEW_REASONS.POLICY_BLOCK);

  if (unsafeReason) reason.push(REVIEW_REASONS.POLICY_BLOCK);

  const enforcementActive = flags.enabled && flags.blockingEnabled;

  return {
    blocked: enforcementActive && unsafeReason,
    unsafe_to_display: enforcementActive && unsafeReason,
    requires_override: unsafeReason,
    shadow_block_recommended: !enforcementActive && unsafeReason,
    reason,
  };
}
