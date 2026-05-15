import type { ImageInput } from "./types";

export type NormalizedImageInput = ImageInput & {
  normalized_mime_type: string;
  normalized_filename?: string;
  original_payload_present: boolean;
};

export function normalizeImageInput(input: ImageInput): NormalizedImageInput {
  const normalizedMime = input.mime_type.trim().toLowerCase();
  const normalizedFilename = input.filename?.replace(/[^\w.\- ]/g, "").trim();

  return {
    ...input,
    mime_type: normalizedMime,
    normalized_mime_type: normalizedMime,
    normalized_filename: normalizedFilename || undefined,
    original_payload_present: Boolean(input.image_base64 || input.raw_bytes),
  };
}
