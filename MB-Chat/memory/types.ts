export type MemoryScopeKind =
  | "global_safe"
  | "tenant"
  | "doctor"
  | "patient"
  | "session"
  | "system";

export type MemoryScope = {
  scope: MemoryScopeKind;
  tenant_id?: string;
  doctor_id?: string;
  patient_id?: string;
  session_id?: string;
};

export type MemoryEntry = {
  id: string;
  tenant_id: string;
  doctor_id: string;
  patient_id?: string;
  scope: MemoryScopeKind;
  kind: string;
  content: string;
  sanitized_content: string;
  source: string;
  confidence: number;
  tags: string[];
  created_at: string;
  expires_at?: string;
  trace_id: string;
  metadata: Record<string, unknown>;
  audit_hash?: string;
};

export type MemorySearchFilters = {
  kind?: string;
  tags?: string[];
  source?: string;
  created_after?: string;
  created_before?: string;
  include_expired?: boolean;
  limit?: number;
};

export type MemorySearchQuery = {
  text: string;
  scope: MemoryScope;
  filters?: MemorySearchFilters;
};

export type MemoryDeleteResult = {
  id: string;
  tombstoned: boolean;
  reason: string;
  trace_id?: string;
};

export type MemoryBackendHealth = {
  ok: boolean;
  backend: string;
  readonly: boolean;
  details?: Record<string, unknown>;
  error?: string;
};

export type MemoryBackend = {
  append(entry: MemoryEntry): Promise<MemoryEntry>;
  get_by_id(id: string): Promise<MemoryEntry | null>;
  search(query: MemorySearchQuery): Promise<MemoryEntry[]>;
  list_recent(scope: MemoryScope, limit: number): Promise<MemoryEntry[]>;
  delete_or_tombstone(id: string, reason: string, trace_id?: string): Promise<MemoryDeleteResult>;
  healthcheck(): Promise<MemoryBackendHealth>;
};

export type MemorySanitizationResult = {
  sanitized_content: string;
  redactions: string[];
  blocked: boolean;
  reason?: string;
};

export type MemoryAuditEvent = {
  event_id: string;
  timestamp: string;
  trace_id: string;
  action: "remember" | "recall" | "delete_or_tombstone" | "healthcheck" | "fallback";
  backend: string;
  tenant_id?: string;
  doctor_id?: string;
  patient_id_present: boolean;
  scope?: MemoryScopeKind;
  success: boolean;
  fallback_used: boolean;
  reason?: string;
  metadata?: Record<string, unknown>;
};

export type MemoryFeatureFlags = {
  enabled: boolean;
  shadowMode: boolean;
  vectorEnabled: boolean;
  writeEnabled: boolean;
  patientScopeEnabled: boolean;
};

export type RememberInput = {
  entry: Omit<MemoryEntry, "sanitized_content" | "audit_hash"> & {
    sanitized_content?: string;
    audit_hash?: string;
  };
};

export type RememberResult = {
  stored: boolean;
  shadowed: boolean;
  entry?: MemoryEntry;
  fallback_used: boolean;
  reason?: string;
};

export type RecallInput = {
  query: string;
  scope: MemoryScope;
  filters?: MemorySearchFilters;
  trace_id: string;
};

export type RecallResult = {
  entries: MemoryEntry[];
  fallback_used: boolean;
  reason?: string;
  retrieval_mode: "disabled" | "lexical_jsonl" | "future_vector";
};
