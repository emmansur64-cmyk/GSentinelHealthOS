import type { ProviderCapabilities } from "../types";

export const GROQ_CAPABILITIES: ProviderCapabilities = {
  supports_text: true,
  supports_image: false,
  supports_multimodal: false,
  supports_structured_output: true,
  supports_streaming: true,
  supports_medical_mode: false,
  max_context_tokens: 8192,
  safe_for_phi: false,
};
