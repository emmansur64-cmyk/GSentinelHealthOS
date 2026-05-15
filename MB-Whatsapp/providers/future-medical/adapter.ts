import { buildProviderResponse } from "../provider-response";
import type { ProviderRequest, ProviderResponse } from "../types";
import { FUTURE_MEDICAL_CAPABILITIES } from "./capabilities";
import { futureMedicalHealthDisabled } from "./health";
import type { FutureMedicalProviderAdapter } from "./contract";

export class DisabledFutureMedicalAdapter implements FutureMedicalProviderAdapter {
  readonly provider_name = "future-medical" as const;
  readonly model_name = "future-medical-disabled";
  readonly capabilities = FUTURE_MEDICAL_CAPABILITIES;

  async complete(input: ProviderRequest): Promise<ProviderResponse> {
    return buildProviderResponse({
      request: input,
      provider_name: "future-medical",
      model_name: this.model_name,
      status: "disabled",
      safety_flags: ["PROVIDER_DISABLED", "NO_EXTERNAL_CALL", "NO_MEDICAL_DIAGNOSIS"],
    });
  }

  async healthcheck() {
    return futureMedicalHealthDisabled();
  }
}
