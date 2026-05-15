import { createHash, randomUUID } from "node:crypto";
import type { MemoryAuditEvent, MemoryEntry, MemoryScope } from "./types";

export function buildMemoryAuditHash(entry: Pick<MemoryEntry, "id" | "trace_id" | "sanitized_content" | "created_at">): string {
  return createHash("sha256")
    .update(`${entry.id}:${entry.trace_id}:${entry.created_at}:${entry.sanitized_content}`)
    .digest("hex");
}

export function buildMemoryAuditEvent(input: {
  action: MemoryAuditEvent["action"];
  backend: string;
  trace_id: string;
  scope?: MemoryScope;
  success: boolean;
  fallback_used: boolean;
  reason?: string;
  metadata?: Record<string, unknown>;
}): MemoryAuditEvent {
  return {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    trace_id: input.trace_id,
    action: input.action,
    backend: input.backend,
    tenant_id: input.scope?.tenant_id,
    doctor_id: input.scope?.doctor_id,
    patient_id_present: Boolean(input.scope?.patient_id),
    scope: input.scope?.scope,
    success: input.success,
    fallback_used: input.fallback_used,
    reason: input.reason,
    metadata: input.metadata,
  };
}

export type MemoryAuditSink = {
  record(event: MemoryAuditEvent): void | Promise<void>;
};

export class InMemoryMemoryAuditSink implements MemoryAuditSink {
  private readonly events: MemoryAuditEvent[] = [];

  record(event: MemoryAuditEvent): void {
    this.events.push(event);
  }

  recent(limit = 50): MemoryAuditEvent[] {
    return this.events.slice(-limit);
  }
}
