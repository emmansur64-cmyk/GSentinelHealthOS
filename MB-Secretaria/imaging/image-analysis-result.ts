import type { ImageAnalysisResult, ImageModality, ImageRiskLevel } from "./types";

export function buildSafeImageAnalysisResult(input: {
  trace_id: string;
  modality: ImageModality;
  findings?: string[];
  risk_level?: ImageRiskLevel;
  confidence_score: number;
  uncertainty_score: number;
  human_review_reason: string;
  provider: string;
  model_version: string;
  audit_ref: string;
  safety_notes?: string[];
}): ImageAnalysisResult {
  return {
    trace_id: input.trace_id,
    status: "metadata_only",
    modality: input.modality,
    findings: input.findings ?? ["Metadata-only image context prepared. No visual diagnosis was performed."],
    risk_level: input.risk_level ?? "unknown",
    confidence_score: input.confidence_score,
    uncertainty_score: input.uncertainty_score,
    requires_human_review: true,
    human_review_reason: input.human_review_reason,
    provider: input.provider,
    model_version: input.model_version,
    no_definitive_diagnosis: true,
    safety_notes: [
      "No definitive diagnosis.",
      "Metadata-only analysis.",
      "Human review required for medical interpretation.",
      ...(input.safety_notes ?? []),
    ],
    audit_ref: input.audit_ref,
    created_at: new Date().toISOString(),
  };
}
