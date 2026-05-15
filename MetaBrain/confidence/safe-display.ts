import type { ClinicalConfidenceFlags, ConfidencePolicy, HallucinationRisk, SafeDisplayResult } from "./types";

export function evaluateSafeDisplay(input: {
  confidenceScore: number;
  uncertaintyScore: number;
  hallucinationRisk: HallucinationRisk;
  escalationRecommended: boolean;
  flags: ClinicalConfidenceFlags;
  policy: ConfidencePolicy;
}): SafeDisplayResult {
  const restrictions: string[] = [];
  if (input.confidenceScore < input.policy.minimumSafeConfidence) restrictions.push("safe_summary_only");
  if (input.uncertaintyScore >= input.policy.highUncertaintyThreshold) restrictions.push("explicit_uncertainty_required");
  if (input.hallucinationRisk.escalation_required) restrictions.push("human_review_recommended");

  const unsafe = input.flags.safeDisplayEnabled && input.flags.blockingEnabled && input.escalationRecommended;

  return {
    safe_to_display: !unsafe,
    unsafe_to_display: unsafe,
    display_restrictions: restrictions,
  };
}
