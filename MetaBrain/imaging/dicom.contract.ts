import type { ImageInput } from "./types";

export type DicomSeries = {
  trace_id: string;
  series_id?: string;
  instance_count?: number;
  safe_metadata: Record<string, unknown>;
};

export type DicomContract = {
  detect_dicom(input: ImageInput): boolean;
  extract_safe_metadata(input: ImageInput): Record<string, unknown>;
  normalize_series(input: ImageInput): Promise<DicomSeries>;
  reject_unsafe(input: ImageInput): { rejected: boolean; reason?: string };
};

export function detectDicomDefensively(input: ImageInput): boolean {
  return input.mime_type.toLowerCase() === "application/dicom" || input.filename?.toLowerCase().endsWith(".dcm") === true;
}

export const DICOM_CONTRACT_STATUS = {
  realDicomParsingImplemented: false,
  dependencyAdded: false,
  enabledByDefault: false,
  note: "No pydicom/MONAI/torch dependency is introduced. Detection is defensive only.",
} as const;
