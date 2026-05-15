import type { ProviderAuditEvent, ProviderRequest, ProviderResponse } from "./types";

export function buildProviderAuditEvent(input: {
  request: ProviderRequest;
  response: ProviderResponse;
  timeout?: boolean;
  phi_detected?: boolean;
  blocked_by_policy?: boolean;
}): ProviderAuditEvent {
  return {
    trace_id: input.request.trace_id,
    provider: input.response.provider_name,
    model: input.response.model_name,
    request_type: input.request.request_type,
    modality: input.request.modality,
    latency_ms: input.response.latency_ms,
    timeout: Boolean(input.timeout),
    fallback_used: input.response.fallback_used,
    retry_count: input.response.retry_count,
    phi_detected: Boolean(input.phi_detected),
    blocked_by_policy: Boolean(input.blocked_by_policy),
    created_at: new Date().toISOString(),
  };
}

export type ProviderAuditSink = {
  record(event: ProviderAuditEvent): void | Promise<void>;
};
