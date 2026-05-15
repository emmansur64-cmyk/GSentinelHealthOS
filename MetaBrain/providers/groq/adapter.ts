import { buildProviderResponse } from "../provider-response";
import type { ProviderRequest, ProviderResponse } from "../types";
import { GROQ_CAPABILITIES } from "./capabilities";
import { groqHealthDisabled } from "./health";
import type { GroqProviderAdapter } from "./contract";

export class DisabledGroqAdapter implements GroqProviderAdapter {
  readonly provider_name = "groq" as const;
  readonly model_name = "groq-disabled";
  readonly capabilities = GROQ_CAPABILITIES;

  async complete(input: ProviderRequest): Promise<ProviderResponse> {
    return buildProviderResponse({
      request: input,
      provider_name: "groq",
      model_name: this.model_name,
      status: "disabled",
      safety_flags: ["PROVIDER_DISABLED", "NO_EXTERNAL_CALL"],
    });
  }

  async healthcheck() {
    return groqHealthDisabled();
  }
}
