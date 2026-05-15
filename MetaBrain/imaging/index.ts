export * from "./types";
export * from "./feature-flags";
export * from "./image-ingestion";
export * from "./image-normalizer";
export * from "./image-metadata-extractor";
export * from "./modality-router";
export * from "./image-analysis-result";
export * from "./image-confidence";
export * from "./image-audit";
export * from "./provider.contract";
export * from "./dicom.contract";
export * from "./legacy-image-adapter";

export const IMAGE_INTELLIGENCE_LAYER_STATUS = {
  phase: "phase_4_controlled_image_pipeline",
  defaultEnabled: false,
  defaultShadowMode: true,
  activePipeline: "legacy_metadata_only",
  providerEnabled: false,
  dicomEnabled: false,
  runtimeConnected: false,
  behaviorChange: false,
} as const;
