export const DEFAULT_PROVIDER_TIMEOUTS = {
  text_ms: 5000,
  image_ms: 8000,
  multimodal_ms: 10000,
  healthcheck_ms: 1500,
} as const;

export function resolveProviderTimeout(input: { requested?: number; modality?: string; requestType?: string }): number {
  if (input.requested && Number.isFinite(input.requested) && input.requested > 0) {
    return Math.min(input.requested, 30000);
  }
  if (input.requestType === "healthcheck") return DEFAULT_PROVIDER_TIMEOUTS.healthcheck_ms;
  if (input.modality === "multimodal") return DEFAULT_PROVIDER_TIMEOUTS.multimodal_ms;
  if (input.modality === "image") return DEFAULT_PROVIDER_TIMEOUTS.image_ms;
  return DEFAULT_PROVIDER_TIMEOUTS.text_ms;
}
