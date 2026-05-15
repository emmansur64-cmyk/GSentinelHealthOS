import { InMemoryObservabilityEventBus } from "./event-bus";
import { buildRequestLineage } from "./request-lineage";
import { buildStructuredLog } from "./structured-logger";
import { createTraceContext } from "./trace-context";
import type { ObservabilityEvent, RequestLineage, TraceContext } from "./types";

export class TraceEngine {
  constructor(private readonly eventBus = new InMemoryObservabilityEventBus()) {}

  startTrace(input: Parameters<typeof createTraceContext>[0]): TraceContext {
    return createTraceContext(input);
  }

  record(input: Parameters<typeof buildStructuredLog>[0]): ObservabilityEvent {
    const event = buildStructuredLog(input);
    this.eventBus.publish(event);
    return event;
  }

  events(): ObservabilityEvent[] {
    return this.eventBus.list();
  }

  lineage(trace_id: string): RequestLineage {
    return buildRequestLineage(trace_id, this.events());
  }
}
