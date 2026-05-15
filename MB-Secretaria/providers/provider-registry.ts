import type { ProviderAdapter, ProviderName } from "./types";

export class ProviderRegistry {
  private readonly providers = new Map<ProviderName, ProviderAdapter>();

  register(provider: ProviderAdapter): void {
    this.providers.set(provider.provider_name, provider);
  }

  get(name: ProviderName): ProviderAdapter | undefined {
    return this.providers.get(name);
  }

  list(): ProviderAdapter[] {
    return [...this.providers.values()];
  }
}
