# MetaBrain Semantic Memory Layer

Phase 3 adds a controlled semantic memory boundary without replacing the current JSONL memory store.

## Status

- Runtime connected: no
- Default enabled: no
- Active compatibility backend: JSONL adapter
- Vector backend: contract only
- Observable behavior change: none intended

## Responsibilities

- Define typed memory contracts for future semantic memory.
- Wrap existing JSONL history through a tolerant adapter.
- Sanitize PHI and secrets before semantic writes.
- Keep tenant, doctor, optional patient, session and system scopes explicit.
- Provide an audit event shape with trace lineage.
- Prepare future pgvector or Qdrant integration without adding dependencies.

## Feature Flags

These flags are documented only in Phase 3 and are intentionally disabled by default:

- `SEMANTIC_MEMORY_ENABLED=false`
- `SEMANTIC_MEMORY_SHADOW_MODE=true`
- `SEMANTIC_MEMORY_VECTOR_ENABLED=false`
- `SEMANTIC_MEMORY_WRITE_ENABLED=false`
- `SEMANTIC_MEMORY_PATIENT_SCOPE_ENABLED=false`

## Safety Notes

- The current JSONL store is not migrated or deleted.
- No external embedding provider is called.
- Patient scoped memory is blocked unless explicitly enabled in a future controlled phase.
- Write behavior is suppressed by default through disabled and shadow modes.
