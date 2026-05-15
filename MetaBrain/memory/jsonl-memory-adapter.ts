import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  MemoryBackend,
  MemoryBackendHealth,
  MemoryDeleteResult,
  MemoryEntry,
  MemoryScope,
  MemorySearchQuery,
} from "./types";

type JsonRecord = Record<string, unknown>;

export type JsonlMemoryAdapterOptions = {
  filePath: string;
  readonly?: boolean;
  onError?: (error: unknown) => void;
};

export class JsonlMemoryAdapter implements MemoryBackend {
  private readonly filePath: string;
  private readonly readonlyMode: boolean;
  private readonly onError?: (error: unknown) => void;

  constructor(options: JsonlMemoryAdapterOptions) {
    this.filePath = options.filePath;
    this.readonlyMode = options.readonly ?? true;
    this.onError = options.onError;
  }

  async append(entry: MemoryEntry): Promise<MemoryEntry> {
    if (this.readonlyMode) {
      throw new Error("jsonl_memory_adapter_readonly");
    }

    mkdirSync(dirname(this.filePath), { recursive: true });
    appendFileSync(this.filePath, `${JSON.stringify(entry)}\n`, { encoding: "utf8" });
    return entry;
  }

  async get_by_id(id: string): Promise<MemoryEntry | null> {
    return this.loadEntries().find((entry) => entry.id === id) ?? null;
  }

  async search(query: MemorySearchQuery): Promise<MemoryEntry[]> {
    const text = query.text.trim().toLowerCase();
    const limit = query.filters?.limit ?? 20;
    const now = new Date();

    return this.loadEntries()
      .filter((entry) => this.matchesScope(entry, query.scope))
      .filter((entry) => query.filters?.include_expired || !entry.expires_at || new Date(entry.expires_at) > now)
      .filter((entry) => !query.filters?.kind || entry.kind === query.filters.kind)
      .filter((entry) => !query.filters?.source || entry.source === query.filters.source)
      .filter((entry) => !query.filters?.tags?.length || query.filters.tags.every((tag) => entry.tags.includes(tag)))
      .filter((entry) => !text || this.searchableText(entry).includes(text))
      .slice(-limit)
      .reverse();
  }

  async list_recent(scope: MemoryScope, limit: number): Promise<MemoryEntry[]> {
    return this.loadEntries()
      .filter((entry) => this.matchesScope(entry, scope))
      .slice(-limit)
      .reverse();
  }

  async delete_or_tombstone(id: string, reason: string, trace_id?: string): Promise<MemoryDeleteResult> {
    if (this.readonlyMode) {
      return { id, tombstoned: false, reason: "jsonl_memory_adapter_readonly", trace_id };
    }

    const tombstone: MemoryEntry = {
      id: `tombstone:${id}:${randomUUID()}`,
      tenant_id: "system",
      doctor_id: "system",
      scope: "system",
      kind: "tombstone",
      content: reason,
      sanitized_content: reason,
      source: "semantic_memory_tombstone",
      confidence: 1,
      tags: ["tombstone", id],
      created_at: new Date().toISOString(),
      trace_id: trace_id ?? "unknown",
      metadata: { tombstoned_id: id, reason },
    };

    await this.append(tombstone);
    return { id, tombstoned: true, reason, trace_id };
  }

  async healthcheck(): Promise<MemoryBackendHealth> {
    try {
      const exists = existsSync(this.filePath);
      return {
        ok: true,
        backend: "jsonl",
        readonly: this.readonlyMode,
        details: {
          filePath: this.filePath,
          exists,
          mode: this.readonlyMode ? "readonly" : "append_enabled",
        },
      };
    } catch (error) {
      return {
        ok: false,
        backend: "jsonl",
        readonly: this.readonlyMode,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private loadEntries(): MemoryEntry[] {
    try {
      if (!existsSync(this.filePath)) {
        return [];
      }

      return readFileSync(this.filePath, "utf8")
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => this.parseLine(line))
        .filter((entry): entry is MemoryEntry => Boolean(entry));
    } catch (error) {
      this.onError?.(error);
      return [];
    }
  }

  private parseLine(line: string): MemoryEntry | null {
    try {
      const record = JSON.parse(line) as JsonRecord;
      if (typeof record.id === "string" && typeof record.sanitized_content === "string") {
        return record as MemoryEntry;
      }
      return this.fromLegacyRecord(record);
    } catch (error) {
      this.onError?.(error);
      return null;
    }
  }

  private fromLegacyRecord(record: JsonRecord): MemoryEntry {
    const contentParts = [
      stringValue(record.input_summary),
      stringValue(record.model_output),
      stringValue(record.decision_output),
      stringValue(record.nlg_output),
    ].filter(Boolean);

    const content = contentParts.join("\n").trim() || JSON.stringify(record);
    const createdAt = stringValue(record.created_at) || stringValue(record.created_at_utc) || new Date(0).toISOString();

    return {
      id: stringValue(record.id) || stringValue(record.entry_id) || stringValue(record.request_id) || randomUUID(),
      tenant_id: stringValue(record.tenant_id) || "legacy_unknown",
      doctor_id: stringValue(record.doctor_id) || "legacy_unknown",
      patient_id: stringValue(record.patient_id) || undefined,
      scope: "system",
      kind: "legacy_jsonl_entry",
      content,
      sanitized_content: content,
      source: stringValue(record.source) || "legacy_jsonl",
      confidence: numberValue(record.confidence, 0.5),
      tags: ["legacy", "jsonl"],
      created_at: createdAt,
      trace_id: stringValue(record.trace_id) || stringValue(record.request_id) || "legacy_unknown",
      metadata: {
        legacy: true,
        embedding_slot: record.embedding_slot,
        fallback_used: record.fallback_used,
      },
    };
  }

  private matchesScope(entry: MemoryEntry, scope: MemoryScope): boolean {
    if (scope.scope === "system") {
      return entry.scope === "system";
    }
    if (scope.tenant_id && entry.tenant_id !== scope.tenant_id) {
      return false;
    }
    if (scope.doctor_id && entry.doctor_id !== scope.doctor_id) {
      return false;
    }
    if (scope.patient_id && entry.patient_id !== scope.patient_id) {
      return false;
    }
    return entry.scope === scope.scope || entry.scope === "system" || entry.scope === "global_safe";
  }

  private searchableText(entry: MemoryEntry): string {
    return [
      entry.content,
      entry.sanitized_content,
      entry.kind,
      entry.source,
      entry.tags.join(" "),
    ]
      .join(" ")
      .toLowerCase();
  }
}

function stringValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === undefined || value === null) {
    return "";
  }
  return JSON.stringify(value);
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
