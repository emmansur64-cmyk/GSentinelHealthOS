import type { ProviderAdapter } from "../types";

export type LocalProviderAdapter = ProviderAdapter & {
  provider_name: "local";
};
