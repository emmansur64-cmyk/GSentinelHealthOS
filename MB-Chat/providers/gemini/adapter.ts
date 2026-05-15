import { buildProviderResponse } from "../provider-response";
import type { ProviderRequest, ProviderResponse } from "../types";
import { GEMINI_CAPABILITIES } from "./capabilities";
import { geminiHealthDisabled } from "./health";
import type { GeminiProviderAdapter } from "./contract";

export class DisabledGeminiAdapter implements GeminiProviderAdapter {
  readonly provider_name = "gemini" as const;
  readonly model_name = "gemini-disabled";
  readonly capabilities = GEMINI_CAPABILITIES;

  async complete(input: ProviderRequest): Promise<ProviderResponse> {
    return buildProviderResponse({
      request: input,
      provider_name: "gemini",
      model_name: this.model_name,
      status: "disabled",
      safety_flags: ["PROVIDER_DISABLED", "NO_EXTERNAL_CALL"],
    });
  }

  async healthcheck() {
    return geminiHealthDisabled();
  }
}
