import { DEFAULT_REVIEW_POLICY } from "./review-policy";
import { REVIEW_REASONS } from "./review-reasons";
import { buildReviewEscalation } from "./review-escalation";
import type { ConfidenceGateInput, ConfidenceGateResult, HumanReviewFlags, ReviewPolicy } from "./types";

export function evaluateConfidenceGate(
  input: ConfidenceGateInput,
  flags: HumanReviewFlags,
  policy: ReviewPolicy = DEFAULT_REVIEW_POLICY,
): ConfidenceGateResult {
  const reasons: string[] = [];
  const confidence = input.confidence_score ?? 0;
  const uncertainty = input.uncertainty_score ?? 1;

  if (flags.lowConfidenceRequired && confidence < policy.lowConfidenceThreshold) reasons.push(REVIEW_REASONS.LOW_CONFIDENCE);
  if (uncertainty >= policy.highUncertaintyThreshold) reasons.push(REVIEW_REASONS.HIGH_UNCERTAINTY);
  if (flags.imageRequired && input.modality === "image") reasons.push(REVIEW_REASONS.IMAGE_REVIEW_REQUIRED);
  if (flags.multimodalRequired && input.modality === "multimodal") reasons.push(REVIEW_REASONS.MULTIMODAL_REVIEW_REQUIRED);
  if (flags.highRiskRequired && policy.highRiskLevels.includes(input.risk_level)) {
    reasons.push(REVIEW_REASONS.HIGH_RISK_REVIEW_REQUIRED);
  }
  if (input.provider_conflict) reasons.push(REVIEW_REASONS.PROVIDER_CONFLICT);
  if (input.hallucination_risk) reasons.push(REVIEW_REASONS.HALLUCINATION_RISK);

  const wouldRequireReview = reasons.length > 0;
  const activeReasons = flags.enabled ? reasons : [REVIEW_REASONS.HUMAN_REVIEW_DISABLED, ...reasons];
  const escalation = buildReviewEscalation(input, activeReasons, policy);
  const blockRecommended = activeReasons.includes(REVIEW_REASONS.HALLUCINATION_RISK) || input.risk_level === "critical";

  return {
    requires_review: flags.enabled ? wouldRequireReview : false,
    would_require_review: wouldRequireReview,
    review_reason: activeReasons,
    escalation,
    blocked: flags.enabled && flags.blockingEnabled && blockRecommended,
    unsafe_to_display: flags.enabled && flags.blockingEnabled && blockRecommended,
    shadow_mode: flags.shadowMode,
  };
}
