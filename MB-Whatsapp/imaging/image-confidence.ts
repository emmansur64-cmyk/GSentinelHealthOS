import type { ImageMetadata, ImageRiskLevel } from "./types";

export type ImageConfidenceResult = {
  confidence_score: number;
  uncertainty_score: number;
  risk_level: ImageRiskLevel;
  requires_human_review: boolean;
  human_review_reason: string;
  safe_to_display: boolean;
};

export function calculateMetadataOnlyConfidence(metadata: ImageMetadata): ImageConfidenceResult {
  const missingCoreMetadata = !metadata.width || !metadata.height || !metadata.pixels_million || !metadata.bytes_per_pixel;
  const qualityPenalty = Math.min(metadata.image_quality_flags.length * 0.08, 0.24);
  const confidence = Math.max(0.1, 0.35 - qualityPenalty - (missingCoreMetadata ? 0.12 : 0));
  const uncertainty = Math.min(0.95, 0.75 + qualityPenalty + (missingCoreMetadata ? 0.1 : 0));

  return {
    confidence_score: round(confidence),
    uncertainty_score: round(uncertainty),
    risk_level: metadata.image_quality_flags.length > 0 ? "medium" : "unknown",
    requires_human_review: true,
    human_review_reason: "metadata_only_no_visual_diagnosis",
    safe_to_display: true,
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
