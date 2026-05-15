import type { ObservabilityEvent } from "./types";

export class InMemoryObservabilityEventBus {
  private events: ObservabilityEvent[] = [];

  publish(event: ObservabilityEvent): void {
    this.events.push(event);
  }

  list(): ObservabilityEvent[] {
    return [...this.events];
  }
}
