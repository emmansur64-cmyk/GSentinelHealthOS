import type { ProviderAdapter } from "../types";

export type OpenAIProviderAdapter = ProviderAdapter & {
  provider_name: "openai";
};
