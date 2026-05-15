import { createHash } from "node:crypto";
import type { ProviderName, ProviderRequest, ProviderResponse, ProviderStatus } from "./types";

export function buildProviderAuditRef(input: Pick<ProviderRequest, "trace_id" | "tenant_id" | "request_type">): string {
  return createHash("sha256").update(`${input.trace_id}:${input.tenant_id}:${input.request_type}`).digest("hex");
}

export function buildProviderResponse(input: {
  request: ProviderRequest;
  provider_name?: ProviderName | "none";
  model_name?: string;
  status: ProviderStatus;
  content?: string;
  latency_ms?: number;
  structured_output?: unknown;
  confidence_score?: number;
  safety_flags?: string[];
  fallback_used?: boolean;
  retry_count?: number;
}): ProviderResponse {
  return {
    trace_id: input.request.trace_id,
    provider_name: input.provider_name ?? "none",
    model_name: input.model_name ?? "none",
    latency_ms: input.latency_ms ?? 0,
    status: input.status,
    content: input.content ?? "",
    structured_output: input.structured_output,
    confidence_score: input.confidence_score,
    safety_flags: input.safety_flags ?? [],
    fallback_used: input.fallback_used ?? false,
    retry_count: input.retry_count ?? 0,
    audit_ref: buildProviderAuditRef(input.request),
    created_at: new Date().toISOString(),
  };
}
