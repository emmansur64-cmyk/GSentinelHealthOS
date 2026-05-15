import type { EvidenceEvaluation, HallucinationRisk, ProviderConsistencyResult } from "./types";

export function calculateUncertaintyScore(input: {
  evidence: EvidenceEvaluation;
  providerConsistency: ProviderConsistencyResult;
  hallucinationRisk: HallucinationRisk;
}): number {
  let uncertainty = 1 - input.evidence.evidence_completeness;
  uncertainty += 1 - input.providerConsistency.consistency_score;
  uncertainty /= 2;
  if (input.hallucinationRisk.risk_level === "high") uncertainty += 0.15;
  if (input.hallucinationRisk.risk_level === "critical") uncertainty += 0.25;
  return Number(Math.max(0, Math.min(1, uncertainty)).toFixed(3));
}
