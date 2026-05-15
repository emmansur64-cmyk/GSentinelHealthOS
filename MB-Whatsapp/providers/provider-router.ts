import { buildProviderAuditEvent, type ProviderAuditSink } from "./provider-audit";
import { buildSafeProviderFallback } from "./provider-fallback";
import { loadProviderFlags } from "./provider-flags";
import { checkProviderHealth } from "./provider-health";
import { sanitizeProviderRequest } from "./provider-context-sanitizer";
import { scoreProvider } from "./provider-scoring";
import type { ProviderAdapter, ProviderFeatureFlags, ProviderRequest, ProviderResponse } from "./types";

export type ProviderRouterOptions = {
  providers: ProviderAdapter[];
  flags?: ProviderFeatureFlags;
  auditSink?: ProviderAuditSink;
};

export class ProviderRouter {
  private readonly providers: ProviderAdapter[];
  private readonly flags: ProviderFeatureFlags;
  private readonly auditSink?: ProviderAuditSink;

  constructor(options: ProviderRouterOptions) {
    this.providers = options.providers;
    this.flags = options.flags ?? loadProviderFlags();
    this.auditSink = options.auditSink;
  }

  async route(input: ProviderRequest): Promise<ProviderResponse> {
    const sanitized = sanitizeProviderRequest(input, this.flags.phiAllowed);
    if (!this.flags.routerEnabled) {
      return this.auditAndReturn(sanitized.request, buildSafeProviderFallback(input, "ROUTER_DISABLED"), sanitized);
    }
    if (this.flags.shadowMode) {
      return this.auditAndReturn(sanitized.request, buildSafeProviderFallback(input, "SHADOW_MODE"), sanitized);
    }
    if (sanitized.blocked_by_policy) {
      return this.auditAndReturn(sanitized.request, buildSafeProviderFallback(input, "PHI_BLOCKED"), sanitized);
    }
    if (input.modality === "multimodal" && !this.flags.multimodalEnabled) {
      return this.auditAndReturn(sanitized.request, buildSafeProviderFallback(input, "MULTIMODAL_DISABLED"), sanitized);
    }
    if (input.image_reference && !this.flags.externalImageEnabled) {
      return this.auditAndReturn(sanitized.request, buildSafeProviderFallback(input, "EXTERNAL_IMAGE_DISABLED"), sanitized);
    }

    const healths = await Promise.all(this.providers.map((provider) => checkProviderHealth(provider)));
    const ranked = this.providers
      .map((provider, index) => ({
        provider,
        score: scoreProvider({ request: sanitized.request, capabilities: provider.capabilities, health: healths[index] }),
      }))
      .sort((a, b) => b.score - a.score);

    const selected = ranked.find((item) => item.score > 0)?.provider;
    if (!selected) {
      return this.auditAndReturn(sanitized.request, buildSafeProviderFallback(input, "NO_AUTHORIZED_PROVIDER"), sanitized);
    }

    try {
      const response = await selected.complete(sanitized.request);
      return this.auditAndReturn(sanitized.request, response, sanitized);
    } catch {
      const fallback = this.flags.fallbackEnabled
        ? buildSafeProviderFallback(input, "PROVIDER_FAILED")
        : buildSafeProviderFallback(input, "PROVIDER_FAILED_FALLBACK_DISABLED");
      return this.auditAndReturn(sanitized.request, fallback, sanitized);
    }
  }

  private async auditAndReturn(
    request: ProviderRequest,
    response: ProviderResponse,
    sanitized: { phi_detected: boolean; blocked_by_policy: boolean },
  ): Promise<ProviderResponse> {
    await this.auditSink?.record(
      buildProviderAuditEvent({
        request,
        response,
        phi_detected: sanitized.phi_detected,
        blocked_by_policy: sanitized.blocked_by_policy,
      }),
    );
    return response;
  }
}
