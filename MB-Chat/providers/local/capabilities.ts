import type { ProviderCapabilities } from "../types";

export const LOCAL_CAPABILITIES: ProviderCapabilities = {
  supports_text: true,
  supports_image: false,
  supports_multimodal: false,
  supports_structured_output: false,
  supports_streaming: false,
  supports_medical_mode: false,
  max_context_tokens: 2048,
  safe_for_phi: true,
};
