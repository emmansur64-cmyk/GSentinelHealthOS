import { DEFAULT_REVIEW_POLICY } from "./review-policy";
import { REVIEW_REASONS } from "./review-reasons";
import type { ConfidenceGateInput, EscalationLevel, ReviewEscalation, ReviewPolicy } from "./types";

export function buildReviewEscalation(input: ConfidenceGateInput, reasons: string[], policy: ReviewPolicy = DEFAULT_REVIEW_POLICY): ReviewEscalation {
  let escalation_level: EscalationLevel = "routine";
  let requires_specialist = false;
  let auto_blocked = false;

  if (policy.specialistRiskLevels.includes(input.risk_level) || input.target_specialty) {
    escalation_level = "specialist";
    requires_specialist = true;
  }

  if (input.risk_level === "critical" || reasons.includes(REVIEW_REASONS.HALLUCINATION_RISK)) {
    escalation_level = "urgent";
  }

  if (reasons.includes(REVIEW_REASONS.POLICY_BLOCK)) {
    escalation_level = "blocked";
    auto_blocked = true;
  }

  return {
    escalation_level,
    escalation_reason: reasons,
    target_specialty: input.target_specialty,
    requires_specialist,
    auto_blocked,
  };
}
