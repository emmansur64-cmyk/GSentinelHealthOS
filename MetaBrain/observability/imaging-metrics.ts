import type { ObservabilityEvent } from "./types";

export function calculateImagingMetrics(events: ObservabilityEvent[]) {
  const scoped = events.filter((event) => event.layer === "imaging");
  return {
    image_event_count: scoped.length,
    human_review_required_count: scoped.filter((event) => event.payload_summary.requires_human_review === true).length,
    metadata_only_count: scoped.filter((event) => event.payload_summary.legacy_metadata_only === true).length,
    unsafe_payload_count: scoped.filter((event) => event.safety_flags.includes("unsafe_image_payload")).length,
  };
}
