import type { ProviderCapabilities, ProviderHealth, ProviderRequest } from "./types";

export function scoreProvider(input: {
  request: ProviderRequest;
  capabilities: ProviderCapabilities;
  health?: ProviderHealth;
}): number {
  let score = 0;
  const { request, capabilities, health } = input;
  if (request.modality === "text" && capabilities.supports_text) score += 40;
  if (request.modality === "image" && capabilities.supports_image) score += 40;
  if (request.modality === "multimodal" && capabilities.supports_multimodal) score += 40;
  if (request.structured_output_schema && capabilities.supports_structured_output) score += 15;
  if (request.safety_level === "phi_possible" && capabilities.safe_for_phi) score += 20;
  if (health?.status === "healthy") score += 20;
  if (health?.status === "degraded") score -= 10;
  if (health?.status === "unavailable" || health?.status === "disabled") score -= 100;
  score -= Math.min((health?.error_rate ?? 0) * 30, 30);
  score -= Math.min((health?.timeout_rate ?? 0) * 30, 30);
  return score;
}
