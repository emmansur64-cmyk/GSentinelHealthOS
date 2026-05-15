import type { ClinicalConfidenceResult, ConfidencePolicy, HallucinationRisk } from "./types";

export function buildEscalationRecommendation(input: {
  confidenceScore: number;
  uncertaintyScore: number;
  hallucinationRisk: HallucinationRisk;
  evidenceCompleteness: number;
  providerConflicts: string[];
  multimodalConflicts: string[];
  policy: ConfidencePolicy;
}): Pick<ClinicalConfidenceResult, "escalation_recommended" | "escalation_reason"> {
  const reasons: string[] = [];
  if (input.confidenceScore < input.policy.minimumSafeConfidence) reasons.push("confidence_below_safe_threshold");
  if (input.uncertaintyScore >= input.policy.highUncertaintyThreshold) reasons.push("high_uncertainty");
  if (input.evidenceCompleteness < input.policy.minimumEvidenceCompleteness) reasons.push("insufficient_evidence");
  if (input.hallucinationRisk.escalation_required) reasons.push(`hallucination_risk_${input.hallucinationRisk.risk_level}`);
  if (input.providerConflicts.length > 0) reasons.push("provider_conflict");
  if (input.multimodalConflicts.length > 0) reasons.push("multimodal_conflict");

  return { escalation_recommended: reasons.length > 0, escalation_reason: reasons };
}
