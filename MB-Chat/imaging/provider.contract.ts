import type { ImageAnalysisResult, ImageInput, ImageModality, ImageProviderHealth } from "./types";

export type ImageProvider = {
  readonly provider_name: string;
  analyze(input: ImageInput): Promise<ImageAnalysisResult>;
  healthcheck(): Promise<ImageProviderHealth>;
  supports_modality(modality: ImageModality): boolean;
};

export const IMAGE_PROVIDER_CONTRACT_STATUS = {
  implementedProviders: [],
  enabledByDefault: false,
  externalCallsAllowedInPhase4: false,
  note: "Contract only. Phase 4 does not send images to external providers.",
} as const;
