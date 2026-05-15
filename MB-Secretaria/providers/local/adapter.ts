import { buildProviderResponse } from "../provider-response";
import type { ProviderRequest, ProviderResponse } from "../types";
import { LOCAL_CAPABILITIES } from "./capabilities";
import { localHealthDisabled } from "./health";
import type { LocalProviderAdapter } from "./contract";

export class DisabledLocalAdapter implements LocalProviderAdapter {
  readonly provider_name = "local" as const;
  readonly model_name = "local-disabled";
  readonly capabilities = LOCAL_CAPABILITIES;

  async complete(input: ProviderRequest): Promise<ProviderResponse> {
    return buildProviderResponse({
      request: input,
      provider_name: "local",
      model_name: this.model_name,
      status: "disabled",
      safety_flags: ["PROVIDER_DISABLED"],
    });
  }

  async healthcheck() {
    return localHealthDisabled();
  }
}
