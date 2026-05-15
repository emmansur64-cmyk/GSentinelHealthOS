import { buildProviderResponse } from "./provider-response";
import type { ProviderRequest, ProviderResponse } from "./types";

export function buildSafeProviderFallback(request: ProviderRequest, reason: string, retryCount = 0): ProviderResponse {
  return buildProviderResponse({
    request,
    provider_name: "none",
    model_name: "safe-fallback",
    status: "fallback",
    content: "",
    latency_ms: 0,
    safety_flags: ["SAFE_FALLBACK", reason],
    fallback_used: true,
    retry_count: retryCount,
  });
}
