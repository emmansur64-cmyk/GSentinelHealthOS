import { createHash } from "node:crypto";
import type { ImageAnalysisResult, ImageAuditEvent, ImageInput, ImageModality } from "./types";

export function buildImageAuditRef(input: Pick<ImageInput, "trace_id" | "tenant_id" | "doctor_id" | "bytes_size">): string {
  return createHash("sha256")
    .update(`${input.trace_id}:${input.tenant_id}:${input.doctor_id}:${input.bytes_size}`)
    .digest("hex");
}

export function buildImageAuditEvent(input: {
  image: ImageInput;
  result: ImageAnalysisResult;
  modality: ImageModality;
}): ImageAuditEvent {
  return {
    trace_id: input.image.trace_id,
    tenant_id: input.image.tenant_id,
    doctor_id: input.image.doctor_id,
    patient_id: input.image.patient_id,
    source: input.image.source,
    modality: input.modality,
    provider: input.result.provider,
    confidence_score: input.result.confidence_score,
    uncertainty_score: input.result.uncertainty_score,
    requires_human_review: input.result.requires_human_review,
    no_definitive_diagnosis: input.result.no_definitive_diagnosis,
    created_at: input.result.created_at,
  };
}
