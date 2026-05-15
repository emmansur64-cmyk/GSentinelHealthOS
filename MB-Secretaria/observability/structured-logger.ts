import { randomUUID } from "node:crypto";
import { sanitizeTelemetryPayload } from "./telemetry-sanitizer";
import type { ObservabilityEvent, ObservabilityLayer, ObservabilitySeverity, TraceContext } from "./types";

export function buildStructuredLog(input: {
  trace: TraceContext;
  layer: ObservabilityLayer;
  event_type: string;
  severity?: ObservabilitySeverity;
  payload_summary?: Record<string, unknown>;
  safety_flags?: string[];
}): ObservabilityEvent {
  return {
    event_id: `evt_${randomUUID()}`,
    trace_id: input.trace.trace_id,
    correlation_id: input.trace.correlation_id,
    layer: input.layer,
    event_type: input.event_type,
    severity: input.severity ?? "info",
    payload_summary: sanitizeTelemetryPayload(input.payload_summary ?? {}),
    safety_flags: input.safety_flags ?? [],
    created_at: new Date().toISOString(),
  };
}
