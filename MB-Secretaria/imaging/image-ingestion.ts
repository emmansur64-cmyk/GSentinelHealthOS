import type { ImageInput } from "./types";

const SUPPORTED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "application/dicom"]);

export type ImageIngestionResult = {
  accepted: boolean;
  input?: ImageInput;
  rejection_reason?: string;
  safety_notes: string[];
};

export function ingestImageInput(input: ImageInput): ImageIngestionResult {
  const safety_notes: string[] = [];

  if (!input.trace_id || !input.tenant_id || !input.doctor_id) {
    return { accepted: false, rejection_reason: "missing_trace_or_scope", safety_notes };
  }

  if (!SUPPORTED_MIME_TYPES.has(input.mime_type.toLowerCase())) {
    return { accepted: false, rejection_reason: "unsupported_mime_type", safety_notes };
  }

  if (!Number.isFinite(input.bytes_size) || input.bytes_size <= 0) {
    return { accepted: false, rejection_reason: "invalid_bytes_size", safety_notes };
  }

  if (!input.image_base64 && !input.raw_bytes && Object.keys(input.metadata).length === 0) {
    return { accepted: false, rejection_reason: "missing_image_payload_or_metadata", safety_notes };
  }

  if (input.image_base64 || input.raw_bytes) {
    safety_notes.push("original_image_not_stored_by_default");
  }

  return { accepted: true, input, safety_notes };
}
