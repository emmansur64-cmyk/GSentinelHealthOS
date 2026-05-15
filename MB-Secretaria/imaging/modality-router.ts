import type { ImageMetadata, ImageModality } from "./types";

export type ModalityRoute = {
  modality: ImageModality;
  provider_allowed: boolean;
  dicom_required: boolean;
  requires_human_review: boolean;
  route_reason: string;
};

export function routeImageModality(metadata: ImageMetadata): ModalityRoute {
  if (metadata.dicom_detected) {
    return {
      modality: "DICOM",
      provider_allowed: false,
      dicom_required: true,
      requires_human_review: true,
      route_reason: "dicom_detected_but_disabled_by_default",
    };
  }

  const modality = metadata.modality ?? mimeToModality(metadata.mime_type);
  return {
    modality,
    provider_allowed: false,
    dicom_required: false,
    requires_human_review: true,
    route_reason: "metadata_only_pipeline",
  };
}

function mimeToModality(mimeType: string): ImageModality {
  const normalized = mimeType.toLowerCase();
  if (normalized === "image/png") {
    return "PNG";
  }
  if (normalized === "image/jpeg" || normalized === "image/jpg") {
    return "JPEG";
  }
  return "UNKNOWN";
}
