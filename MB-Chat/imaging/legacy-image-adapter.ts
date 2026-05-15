import { buildImageAuditRef } from "./image-audit";
import { buildSafeImageAnalysisResult } from "./image-analysis-result";
import { calculateMetadataOnlyConfidence } from "./image-confidence";
import { extractImageMetadata } from "./image-metadata-extractor";
import { ingestImageInput } from "./image-ingestion";
import { normalizeImageInput } from "./image-normalizer";
import { routeImageModality } from "./modality-router";
import type { ImageAnalysisResult, ImageInput } from "./types";

export class LegacyImageAdapter {
  readonly legacy_metadata_only = true;
  readonly no_visual_diagnosis = true;
  readonly no_definitive_diagnosis = true;

  analyze(input: ImageInput): ImageAnalysisResult {
    const ingestion = ingestImageInput(input);
    if (!ingestion.accepted || !ingestion.input) {
      return buildSafeImageAnalysisResult({
        trace_id: input.trace_id,
        modality: "UNKNOWN",
        findings: ["Image input was rejected before analysis. No visual diagnosis was performed."],
        risk_level: "unknown",
        confidence_score: 0,
        uncertainty_score: 1,
        human_review_reason: ingestion.rejection_reason ?? "image_ingestion_rejected",
        provider: "legacy_metadata_adapter",
        model_version: "metadata_only_v1",
        audit_ref: buildImageAuditRef(input),
        safety_notes: ingestion.safety_notes,
      });
    }

    const normalized = normalizeImageInput(ingestion.input);
    const metadata = extractImageMetadata(normalized);
    const route = routeImageModality(metadata);
    const confidence = calculateMetadataOnlyConfidence(metadata);

    return buildSafeImageAnalysisResult({
      trace_id: normalized.trace_id,
      modality: route.modality,
      findings: [
        "Legacy metadata-only image context prepared.",
        `Quality flags: ${metadata.image_quality_flags.length ? metadata.image_quality_flags.join(", ") : "none"}.`,
      ],
      risk_level: confidence.risk_level,
      confidence_score: confidence.confidence_score,
      uncertainty_score: confidence.uncertainty_score,
      human_review_reason: route.route_reason || confidence.human_review_reason,
      provider: "legacy_metadata_adapter",
      model_version: "metadata_only_v1",
      audit_ref: buildImageAuditRef(normalized),
      safety_notes: [
        ...ingestion.safety_notes,
        "legacy_metadata_only=true",
        "no_visual_diagnosis=true",
        "requires_human_review=true",
      ],
    });
  }
}
