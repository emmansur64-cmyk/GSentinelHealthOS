import type { EvidenceEvaluation, HallucinationRisk, ProviderConsistencyResult } from "./types";

export function calculateConfidenceScore(input: {
  evidence: EvidenceEvaluation;
  providerConsistency: ProviderConsistencyResult;
  uncertaintyScore: number;
  hallucinationRisk: HallucinationRisk;
}): number {
  let score = input.evidence.evidence_completeness * 0.4 + input.providerConsistency.consistency_score * 0.35 + (1 - input.uncertaintyScore) * 0.25;
  if (input.hallucinationRisk.risk_level === "high") score -= 0.15;
  if (input.hallucinationRisk.risk_level === "critical") score -= 0.25;
  return Number(Math.max(0, Math.min(1, score)).toFixed(3));
}
