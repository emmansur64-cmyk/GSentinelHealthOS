import { randomUUID } from "node:crypto";
import { loadMemoryFeatureFlags } from "./feature-flags";
import { buildMemoryAuditEvent, buildMemoryAuditHash, type MemoryAuditSink } from "./memory-audit";
import { MemoryRetriever } from "./memory-retriever";
import { MemorySanitizer, defaultMemorySanitizer } from "./memory-sanitizer";
import type {
  MemoryBackend,
  MemoryFeatureFlags,
  RecallInput,
  RecallResult,
  RememberInput,
  RememberResult,
} from "./types";

export type SemanticMemoryServiceOptions = {
  backend: MemoryBackend;
  flags?: MemoryFeatureFlags;
  sanitizer?: MemorySanitizer;
  auditSink?: MemoryAuditSink;
};

export class SemanticMemoryService {
  private readonly backend: MemoryBackend;
  private readonly flags: MemoryFeatureFlags;
  private readonly sanitizer: MemorySanitizer;
  private readonly retriever: MemoryRetriever;
  private readonly auditSink?: MemoryAuditSink;

  constructor(options: SemanticMemoryServiceOptions) {
    this.backend = options.backend;
    this.flags = options.flags ?? loadMemoryFeatureFlags();
    this.sanitizer = options.sanitizer ?? defaultMemorySanitizer;
    this.retriever = new MemoryRetriever(this.backend);
    this.auditSink = options.auditSink;
  }

  async remember(input: RememberInput): Promise<RememberResult> {
    const entryScope = {
      scope: input.entry.scope,
      tenant_id: input.entry.tenant_id,
      doctor_id: input.entry.doctor_id,
      patient_id: input.entry.patient_id,
    };

    try {
      if (!this.flags.enabled) {
        await this.audit("remember", input.entry.trace_id, false, true, "semantic_memory_disabled", entryScope);
        return { stored: false, shadowed: false, fallback_used: true, reason: "semantic_memory_disabled" };
      }

      if (input.entry.patient_id && !this.flags.patientScopeEnabled) {
        await this.audit("remember", input.entry.trace_id, false, true, "patient_scope_disabled", entryScope);
        return { stored: false, shadowed: false, fallback_used: true, reason: "patient_scope_disabled" };
      }

      const sanitized = this.sanitizer.sanitizeContent(input.entry.content);
      if (sanitized.blocked) {
        await this.audit("remember", input.entry.trace_id, false, true, sanitized.reason ?? "sanitizer_blocked", entryScope);
        return { stored: false, shadowed: false, fallback_used: true, reason: sanitized.reason };
      }

      const entry = {
        ...input.entry,
        id: input.entry.id || randomUUID(),
        sanitized_content: sanitized.sanitized_content,
        metadata: {
          ...this.sanitizer.sanitizeMetadata(input.entry.metadata),
          sanitizer_redactions: sanitized.redactions,
        },
      };
      entry.audit_hash = buildMemoryAuditHash(entry);

      if (this.flags.shadowMode || !this.flags.writeEnabled) {
        await this.audit("remember", entry.trace_id, true, false, "shadow_mode_write_suppressed", entryScope);
        return { stored: false, shadowed: true, entry, fallback_used: false, reason: "shadow_mode_write_suppressed" };
      }

      const stored = await this.backend.append(entry);
      await this.audit("remember", stored.trace_id, true, false, undefined, entryScope);
      return { stored: true, shadowed: false, entry: stored, fallback_used: false };
    } catch (error) {
      await this.audit(
        "fallback",
        input.entry.trace_id,
        false,
        true,
        error instanceof Error ? error.message : String(error),
        entryScope,
      );
      return { stored: false, shadowed: false, fallback_used: true, reason: "semantic_memory_remember_failed" };
    }
  }

  async recall(input: RecallInput): Promise<RecallResult> {
    try {
      if (!this.flags.enabled) {
        await this.audit("recall", input.trace_id, true, true, "semantic_memory_disabled", input.scope);
        return {
          entries: [],
          fallback_used: true,
          reason: "semantic_memory_disabled",
          retrieval_mode: "disabled",
        };
      }

      if (input.scope.patient_id && !this.flags.patientScopeEnabled) {
        await this.audit("recall", input.trace_id, true, true, "patient_scope_disabled", input.scope);
        return {
          entries: [],
          fallback_used: true,
          reason: "patient_scope_disabled",
          retrieval_mode: "disabled",
        };
      }

      const result = await this.retriever.search({
        query: input.query,
        scope: input.scope,
        filters: input.filters,
      });
      await this.audit("recall", input.trace_id, true, false, undefined, input.scope);
      return {
        entries: result.entries,
        fallback_used: false,
        retrieval_mode: result.retrieval_mode,
      };
    } catch (error) {
      await this.audit(
        "fallback",
        input.trace_id,
        false,
        true,
        error instanceof Error ? error.message : String(error),
        input.scope,
      );
      return {
        entries: [],
        fallback_used: true,
        reason: "semantic_memory_recall_failed",
        retrieval_mode: "disabled",
      };
    }
  }

  async trainFromMedicalChat(input: MedicalChatLearningRecord): Promise<boolean> {
    try {
      const entry = {
        id: input.id,
        tenant_id: "medical-chat",
        doctor_id: input.role === "DOCTOR" ? input.role : "system",
        patient_id: input.sessionId,
        scope: "session",
        kind: "training-record",
        content: input.queryHash,
        sanitized_content: input.explicitTeaching?.sanitizedText || "",
        source: "medical-chat-learning",
        confidence: input.decision.confidence,
        tags: input.concepts,
        created_at: input.recordedAt,
        metadata: {
          modality: input.modality,
          citations: input.citationCount,
          outcome: input.outcome,
          decision: input.decision,
        },
      };

      await this.backend.append(entry);
      return true;
    } catch (error) {
      console.error("Failed to train from medical chat record:", error);
      return false;
    }
  }

  private async audit(
    action: "remember" | "recall" | "fallback",
    traceId: string,
    success: boolean,
    fallbackUsed: boolean,
    reason?: string,
    scope?: RecallInput["scope"],
  ): Promise<void> {
    if (!this.auditSink) {
      return;
    }

    await this.auditSink.record(
      buildMemoryAuditEvent({
        action,
        backend: "jsonl",
        trace_id: traceId,
        scope,
        success,
        fallback_used: fallbackUsed,
        reason,
      }),
    );
  }
}
