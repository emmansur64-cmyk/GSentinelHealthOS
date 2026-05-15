import type { ObservabilityEvent } from "./types";

export function calculateMemoryMetrics(events: ObservabilityEvent[]) {
  const scoped = events.filter((event) => event.layer === "memory");
  return {
    memory_event_count: scoped.length,
    recall_count: scoped.filter((event) => event.event_type.includes("recall")).length,
    write_count: scoped.filter((event) => event.event_type.includes("remember")).length,
    fallback_count: scoped.filter((event) => event.event_type.includes("fallback")).length,
  };
}
