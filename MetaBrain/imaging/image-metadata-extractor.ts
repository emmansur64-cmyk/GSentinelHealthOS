import type { ImageInput, ImageMetadata, ImageModality } from "./types";

const SENSITIVE_METADATA_KEYS = ["patient", "name", "email", "phone", "address", "token", "secret", "gps", "latitude", "longitude"];

export function extractImageMetadata(input: ImageInput): ImageMetadata {
  const metadata = sanitizeImageMetadata(input.metadata);
  const width = numberValue(metadata.width ?? metadata.image_width);
  const height = numberValue(metadata.height ?? metadata.image_height);
  const pixels = width && height ? (width * height) / 1_000_000 : numberValue(metadata.pixels_million);
  const aspectRatio = width && height ? width / Math.max(height, 1) : numberValue(metadata.aspect_ratio);
  const bytesPerPixel =
    width && height ? input.bytes_size / Math.max(width * height, 1) : numberValue(metadata.bytes_per_pixel);

  return {
    mime_type: input.mime_type,
    width,
    height,
    aspect_ratio: roundOptional(aspectRatio, 6),
    pixels_million: roundOptional(pixels, 6),
    bytes_per_pixel: roundOptional(bytesPerPixel, 8),
    modality: normalizeModality(metadata.modality),
    dicom_detected: isDicom(input),
    image_quality_flags: buildQualityFlags(width, height, input.bytes_size, bytesPerPixel),
    sanitized_metadata: metadata,
  };
}

export function sanitizeImageMetadata(metadata: Record<string, unknown> = {}): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    const normalizedKey = key.toLowerCase();
    if (SENSITIVE_METADATA_KEYS.some((sensitive) => normalizedKey.includes(sensitive))) {
      sanitized[key] = "[REDACTED_METADATA]";
      continue;
    }
    sanitized[key] = typeof value === "string" ? value.replace(/<[^>]*>/g, "").slice(0, 500) : value;
  }

  return sanitized;
}

function buildQualityFlags(width?: number, height?: number, bytesSize?: number, bytesPerPixel?: number): string[] {
  const flags: string[] = [];
  if (!width || !height) {
    flags.push("missing_dimensions");
  }
  if (width && height && width * height < 250_000) {
    flags.push("low_pixel_count");
  }
  if (bytesSize !== undefined && bytesSize > 15 * 1024 * 1024) {
    flags.push("large_payload");
  }
  if (bytesPerPixel !== undefined && bytesPerPixel < 0.15) {
    flags.push("low_bytes_per_pixel");
  }
  return flags;
}

function isDicom(input: ImageInput): boolean {
  return input.mime_type.toLowerCase() === "application/dicom" || input.filename?.toLowerCase().endsWith(".dcm") === true;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function roundOptional(value: number | undefined, precision: number): number | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function normalizeModality(value: unknown): ImageModality | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.toUpperCase();
  return ["TEXT", "XRAY", "CT", "MRI", "DICOM", "PNG", "JPG", "JPEG", "UNKNOWN"].includes(normalized)
    ? (normalized as ImageModality)
    : "UNKNOWN";
}
