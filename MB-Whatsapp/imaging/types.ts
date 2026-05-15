export type ImageSource = "api_base64" | "multipart_upload" | "gateway" | "legacy_model" | "unknown";
export type ImageModality = "TEXT" | "XRAY" | "CT" | "MRI" | "DICOM" | "PNG" | "JPG" | "JPEG" | "UNKNOWN";
export type ImageRiskLevel = "low" | "medium" | "high" | "unknown";
export type ImageAnalysisStatus = "skipped" | "metadata_only" | "provider_disabled" | "fallback" | "completed";

export type ImageInput = {
  trace_id: string;
  tenant_id: string;
  doctor_id: string;
  patient_id?: string;
  source: ImageSource | string;
  mime_type: string;
  filename?: string;
  bytes_size: number;
  image_base64?: string;
  raw_bytes?: Uint8Array;
  metadata: Record<string, unknown>;
};

export type ImageMetadata = {
  mime_type: string;
  width?: number;
  height?: number;
  aspect_ratio?: number;
  pixels_million?: number;
  bytes_per_pixel?: number;
  modality?: ImageModality;
  dicom_detected: boolean;
  image_quality_flags: string[];
  sanitized_metadata: Record<string, unknown>;
};

export type ImageAnalysisResult = {
  trace_id: string;
  status: ImageAnalysisStatus;
  modality: ImageModality;
  findings: string[];
  risk_level: ImageRiskLevel;
  confidence_score: number;
  uncertainty_score: number;
  requires_human_review: boolean;
  human_review_reason: string;
  provider: string;
  model_version: string;
  no_definitive_diagnosis: boolean;
  safety_notes: string[];
  audit_ref: string;
  created_at: string;
};

export type ImageAuditEvent = {
  trace_id: string;
  tenant_id: string;
  doctor_id: string;
  patient_id?: string;
  source: string;
  modality: ImageModality;
  provider: string;
  confidence_score: number;
  uncertainty_score: number;
  requires_human_review: boolean;
  no_definitive_diagnosis: boolean;
  created_at: string;
};

export type ImageProviderHealth = {
  ok: boolean;
  provider: string;
  enabled: boolean;
  details?: Record<string, unknown>;
  error?: string;
};

export type ImageFeatureFlags = {
  medicalVisionEnabled: boolean;
  medicalVisionShadowMode: boolean;
  medicalVisionProviderEnabled: boolean;
  dicomEnabled: boolean;
  dicomShadowMode: boolean;
  imageHumanReviewRequired: boolean;
  imageStoreOriginal: boolean;
};
