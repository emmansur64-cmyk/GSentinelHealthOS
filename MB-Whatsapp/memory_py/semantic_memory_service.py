from __future__ import annotations

import os
from dataclasses import replace
from typing import Any, Optional

from .audit import InMemoryAuditSink, build_memory_audit_event, build_memory_audit_hash
from .jsonl_adapter import JsonlMemoryAdapter
from .retriever import MemoryRetriever
from .sanitizer import MemorySanitizer
from .types import MemoryEntry, MemoryFeatureFlags, MemoryScope


def _read_bool(value: Optional[str], fallback: bool) -> bool:
    if value is None:
        return fallback
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return fallback


def load_memory_feature_flags(env: dict[str, str] | None = None) -> MemoryFeatureFlags:
    values = env if env is not None else os.environ
    return MemoryFeatureFlags(
        enabled=_read_bool(values.get("SEMANTIC_MEMORY_ENABLED"), False),
        shadow_mode=_read_bool(values.get("SEMANTIC_MEMORY_SHADOW_MODE"), True),
        vector_enabled=_read_bool(values.get("SEMANTIC_MEMORY_VECTOR_ENABLED"), False),
        write_enabled=_read_bool(values.get("SEMANTIC_MEMORY_WRITE_ENABLED"), False),
        patient_scope_enabled=_read_bool(values.get("SEMANTIC_MEMORY_PATIENT_SCOPE_ENABLED"), False),
    )


class SemanticMemoryService:
    def __init__(
        self,
        backend: JsonlMemoryAdapter,
        flags: MemoryFeatureFlags | None = None,
        sanitizer: MemorySanitizer | None = None,
        audit_sink: InMemoryAuditSink | None = None,
    ) -> None:
        self.backend = backend
        self.flags = flags or load_memory_feature_flags()
        self.sanitizer = sanitizer or MemorySanitizer()
        self.retriever = MemoryRetriever(backend)
        self.audit_sink = audit_sink

    def remember(self, entry: MemoryEntry) -> dict[str, Any]:
        scope = MemoryScope(
            scope=entry.scope,
            tenant_id=entry.tenant_id,
            doctor_id=entry.doctor_id,
            patient_id=entry.patient_id,
        )
        try:
            if not self.flags.enabled:
                self._audit("remember", entry.trace_id, scope, False, True, "semantic_memory_disabled")
                return {"stored": False, "shadowed": False, "fallback_used": True, "reason": "semantic_memory_disabled"}

            if entry.patient_id and not self.flags.patient_scope_enabled:
                self._audit("remember", entry.trace_id, scope, False, True, "patient_scope_disabled")
                return {"stored": False, "shadowed": False, "fallback_used": True, "reason": "patient_scope_disabled"}

            sanitized = self.sanitizer.sanitize_content(entry.content)
            if sanitized.get("blocked"):
                reason = sanitized.get("reason") or "sanitizer_blocked"
                self._audit("remember", entry.trace_id, scope, False, True, reason)
                return {"stored": False, "shadowed": False, "fallback_used": True, "reason": reason}

            sanitized_metadata = self.sanitizer.sanitize_metadata(entry.metadata)
            sanitized_metadata["sanitizer_redactions"] = sanitized.get("redactions", [])
            prepared = replace(
                entry,
                sanitized_content=sanitized["sanitized_content"],
                metadata=sanitized_metadata,
            )
            prepared.audit_hash = build_memory_audit_hash(prepared)

            if self.flags.shadow_mode or not self.flags.write_enabled:
                self._audit("remember", prepared.trace_id, scope, True, False, "shadow_mode_write_suppressed")
                return {
                    "stored": False,
                    "shadowed": True,
                    "entry": prepared,
                    "fallback_used": False,
                    "reason": "shadow_mode_write_suppressed",
                }

            stored = self.backend.append(prepared)
            self._audit("remember", stored.trace_id, scope, True, False)
            return {"stored": True, "shadowed": False, "entry": stored, "fallback_used": False}
        except Exception:
            self._audit("fallback", entry.trace_id, scope, False, True, "semantic_memory_remember_failed")
            return {"stored": False, "shadowed": False, "fallback_used": True, "reason": "semantic_memory_remember_failed"}

    def recall(self, query: str, scope: MemoryScope, trace_id: str, limit: int = 20) -> dict[str, Any]:
        try:
            if not self.flags.enabled:
                self._audit("recall", trace_id, scope, True, True, "semantic_memory_disabled")
                return {
                    "entries": [],
                    "fallback_used": True,
                    "reason": "semantic_memory_disabled",
                    "retrieval_mode": "disabled",
                }

            if scope.patient_id and not self.flags.patient_scope_enabled:
                self._audit("recall", trace_id, scope, True, True, "patient_scope_disabled")
                return {
                    "entries": [],
                    "fallback_used": True,
                    "reason": "patient_scope_disabled",
                    "retrieval_mode": "disabled",
                }

            result = self.retriever.search(query=query, scope=scope, limit=limit)
            self._audit("recall", trace_id, scope, True, False)
            return {**result, "fallback_used": False}
        except Exception:
            self._audit("fallback", trace_id, scope, False, True, "semantic_memory_recall_failed")
            return {
                "entries": [],
                "fallback_used": True,
                "reason": "semantic_memory_recall_failed",
                "retrieval_mode": "disabled",
            }

    def _audit(
        self,
        action: str,
        trace_id: str,
        scope: MemoryScope,
        success: bool,
        fallback_used: bool,
        reason: str | None = None,
    ) -> None:
        if not self.audit_sink:
            return
        self.audit_sink.record(
            build_memory_audit_event(
                action=action,
                backend="jsonl",
                trace_id=trace_id,
                scope=scope,
                success=success,
                fallback_used=fallback_used,
                reason=reason,
            )
        )
