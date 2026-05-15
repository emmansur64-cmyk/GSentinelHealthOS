import type { EvidenceEvaluation, HallucinationRisk, ProviderConsistencyResult } from "./types";

export function estimateHallucinationRisk(input: {
  evidence: EvidenceEvaluation;
  providerConsistency: ProviderConsistencyResult;
  multimodalConflictDetected: boolean;
}): HallucinationRisk {
  let score = 0;
  if (input.evidence.evidence_completeness < 0.55) score += 0.35;
  if (input.providerConsistency.conflicts_detected) score += 0.25;
  if (input.providerConsistency.consistency_score < 0.5) score += 0.2;
  if (input.multimodalConflictDetected) score += 0.25;
  if (input.evidence.conflict_signals.length > 0) score += 0.15;

  const bounded = Math.min(1, score);
  const risk_level = bounded >= 0.85 ? "critical" : bounded >= 0.65 ? "high" : bounded >= 0.35 ? "medium" : "low";

  return {
    risk_level,
    unsupported_claims_detected: input.evidence.evidence_completeness < 0.55,
    evidence_missing: input.evidence.missing_evidence.length > 0,
    multimodal_inconsistency: input.multimodalConflictDetected,
    provider_divergence: input.providerConsistency.conflicts_detected,
    escalation_required: risk_level === "high" || risk_level === "critical",
  };
}
