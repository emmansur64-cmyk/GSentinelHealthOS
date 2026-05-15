import { createCorrelationId, createTraceId } from "./correlation";
import type { TraceContext } from "./types";

export function createTraceContext(input: {
  tenant_id: string;
  request_type: string;
  source_layer: string;
  parent_trace_id?: string;
  trace_id?: string;
  correlation_id?: string;
}): TraceContext {
  return {
    trace_id: input.trace_id ?? createTraceId(),
    correlation_id: input.correlation_id ?? createCorrelationId(),
    parent_trace_id: input.parent_trace_id,
    tenant_id: input.tenant_id,
    request_type: input.request_type,
    source_layer: input.source_layer,
    created_at: new Date().toISOString(),
  };
}
