import type { ImageFeatureFlags } from "./types";

export const DEFAULT_IMAGE_FEATURE_FLAGS: ImageFeatureFlags = {
  medicalVisionEnabled: false,
  medicalVisionShadowMode: true,
  medicalVisionProviderEnabled: false,
  dicomEnabled: false,
  dicomShadowMode: true,
  imageHumanReviewRequired: true,
  imageStoreOriginal: false,
};

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) {
    return true;
  }
  if (FALSE_VALUES.has(normalized)) {
    return false;
  }
  return fallback;
}

export function loadImageFeatureFlags(env: Record<string, string | undefined> = process.env): ImageFeatureFlags {
  return {
    medicalVisionEnabled: readBoolean(env.MEDICAL_VISION_ENABLED, DEFAULT_IMAGE_FEATURE_FLAGS.medicalVisionEnabled),
    medicalVisionShadowMode: readBoolean(
      env.MEDICAL_VISION_SHADOW_MODE,
      DEFAULT_IMAGE_FEATURE_FLAGS.medicalVisionShadowMode,
    ),
    medicalVisionProviderEnabled: readBoolean(
      env.MEDICAL_VISION_PROVIDER_ENABLED,
      DEFAULT_IMAGE_FEATURE_FLAGS.medicalVisionProviderEnabled,
    ),
    dicomEnabled: readBoolean(env.DICOM_ENABLED, DEFAULT_IMAGE_FEATURE_FLAGS.dicomEnabled),
    dicomShadowMode: readBoolean(env.DICOM_SHADOW_MODE, DEFAULT_IMAGE_FEATURE_FLAGS.dicomShadowMode),
    imageHumanReviewRequired: readBoolean(
      env.IMAGE_HUMAN_REVIEW_REQUIRED,
      DEFAULT_IMAGE_FEATURE_FLAGS.imageHumanReviewRequired,
    ),
    imageStoreOriginal: readBoolean(env.IMAGE_STORE_ORIGINAL, DEFAULT_IMAGE_FEATURE_FLAGS.imageStoreOriginal),
  };
}

export const DOCUMENTED_IMAGE_FLAGS = {
  MEDICAL_VISION_ENABLED: "false",
  MEDICAL_VISION_SHADOW_MODE: "true",
  MEDICAL_VISION_PROVIDER_ENABLED: "false",
  DICOM_ENABLED: "false",
  DICOM_SHADOW_MODE: "true",
  IMAGE_HUMAN_REVIEW_REQUIRED: "true",
  IMAGE_STORE_ORIGINAL: "false",
} as const;
