import { buildProviderResponse } from "../provider-response";
import type { ProviderRequest, ProviderResponse } from "../types";
import { OPENAI_CAPABILITIES } from "./capabilities";
import { openAIHealthDisabled } from "./health";
import type { OpenAIProviderAdapter } from "./contract";

export class DisabledOpenAIAdapter implements OpenAIProviderAdapter {
  readonly provider_name = "openai" as const;
  readonly model_name = "openai-disabled";
  readonly capabilities = OPENAI_CAPABILITIES;

  async complete(input: ProviderRequest): Promise<ProviderResponse> {
    return buildProviderResponse({
      request: input,
      provider_name: "openai",
      model_name: this.model_name,
      status: "disabled",
      safety_flags: ["PROVIDER_DISABLED", "NO_EXTERNAL_CALL"],
    });
  }

  async healthcheck() {
    return openAIHealthDisabled();
  }
}
