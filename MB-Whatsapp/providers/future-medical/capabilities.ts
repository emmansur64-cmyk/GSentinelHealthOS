import type { ProviderCapabilities } from "../types";

export const FUTURE_MEDICAL_CAPABILITIES: ProviderCapabilities = {
  supports_text: true,
  supports_image: true,
  supports_multimodal: true,
  supports_structured_output: true,
  supports_streaming: false,
  supports_medical_mode: true,
  max_context_tokens: 16384,
  safe_for_phi: false,
};
