import type { ObservabilityEvent } from "./types";

export function calculateSafetyMetrics(events: ObservabilityEvent[]) {
  return {
    safety_event_count: events.filter((event) => event.safety_flags.length > 0).length,
    phi_redaction_count: events.filter((event) => event.safety_flags.includes("phi_redacted")).length,
    unsafe_to_display_count: events.filter((event) => event.payload_summary.unsafe_to_display === true).length,
    blocked_output_count: events.filter((event) => event.event_type.includes("blocked")).length,
  };
}
