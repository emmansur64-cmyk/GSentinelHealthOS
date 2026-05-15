import type { ClinicalConfidenceResult, EvidenceEvaluation } from "./types";

export function explainConfidence(input: {
  result: Omit<ClinicalConfidenceResult, "confidence_explanation">;
  evidence: EvidenceEvaluation;
}): string[] {
  const explanation: string[] = [];
  if (input.result.provider_consistency.conflicts_detected) explanation.push("Low provider agreement or unresolved provider conflict.");
  if (input.evidence.missing_evidence.includes("retrieval_unavailable")) explanation.push("Insufficient retrieval evidence.");
  if (input.result.multimodal_conflict_detected) explanation.push("Multimodal signals are incomplete or conflicting.");
  if (input.result.hallucination_risk.evidence_missing) explanation.push("Claims require stronger supporting evidence.");
  if (input.result.uncertainty_score >= 0.7) explanation.push("High uncertainty from incomplete or conflicting signals.");
  if (explanation.length === 0) explanation.push("Available signals are consistent enough for shadow confidence scoring.");
  return explanation;
}
