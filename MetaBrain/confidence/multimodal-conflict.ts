import type { ClinicalConfidenceInput, MultimodalConflictResult } from "./types";

export function detectMultimodalConflict(input: ClinicalConfidenceInput): MultimodalConflictResult {
  const conflicts: string[] = [];

  if (input.modality === "text") return { multimodal_conflict_detected: false, conflicts };
  if (input.image_summary?.conflicts?.length) conflicts.push(...input.image_summary.conflicts.map((item) => `image:${item}`));
  if (input.retrieval_summary.conflicts?.length) conflicts.push(...input.retrieval_summary.conflicts.map((item) => `retrieval:${item}`));
  if (input.memory_context_summary.conflicts?.length) conflicts.push(...input.memory_context_summary.conflicts.map((item) => `memory:${item}`));
  if (input.modality === "multimodal" && !input.image_summary?.available) conflicts.push("multimodal_image_evidence_missing");

  return {
    multimodal_conflict_detected: conflicts.length > 0,
    conflicts,
  };
}
