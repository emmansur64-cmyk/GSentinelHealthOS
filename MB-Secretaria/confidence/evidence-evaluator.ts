import type { ClinicalConfidenceInput, EvidenceEvaluation } from "./types";

function scoreLayer(available: boolean, quality?: number): number {
  if (!available) return 0;
  return Math.max(0, Math.min(1, quality ?? 0.6));
}

export function evaluateEvidence(input: ClinicalConfidenceInput): EvidenceEvaluation {
  const missing: string[] = [];
  const conflicts: string[] = [];
  const retrieval = scoreLayer(input.retrieval_summary.available, input.retrieval_summary.quality_score);
  const memory = scoreLayer(input.memory_context_summary.available, input.memory_context_summary.quality_score);
  const risk = scoreLayer(input.risk_summary.available, input.risk_summary.quality_score);
  const imageNeeded = input.modality === "image" || input.modality === "multimodal";
  const image = imageNeeded ? scoreLayer(Boolean(input.image_summary?.available), input.image_summary?.quality_score) : 1;

  if (!input.retrieval_summary.available) missing.push("retrieval_unavailable");
  if (!input.memory_context_summary.available) missing.push("memory_context_unavailable");
  if (!input.risk_summary.available) missing.push("risk_summary_unavailable");
  if (imageNeeded && !input.image_summary?.available) missing.push("image_summary_unavailable");

  for (const layer of [input.retrieval_summary, input.memory_context_summary, input.risk_summary, input.image_summary]) {
    conflicts.push(...(layer?.conflicts ?? []));
  }

  return {
    evidence_completeness: Number(((retrieval + memory + risk + image) / 4).toFixed(3)),
    missing_evidence: missing,
    conflict_signals: conflicts,
  };
}
