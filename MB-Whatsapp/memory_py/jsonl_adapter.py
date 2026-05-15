from __future__ import annotations

import json
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

from .types import MemoryBackendHealth, MemoryDeleteResult, MemoryEntry, MemoryScope


class JsonlMemoryAdapter:
    def __init__(self, file_path: str | Path, readonly: bool = True) -> None:
        self.file_path = Path(file_path)
        self.readonly = readonly

    def append(self, entry: MemoryEntry) -> MemoryEntry:
        if self.readonly:
            raise RuntimeError("jsonl_memory_adapter_readonly")
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        with self.file_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(asdict(entry), ensure_ascii=False) + "\n")
        return entry

    def get_by_id(self, memory_id: str) -> Optional[MemoryEntry]:
        return next((entry for entry in self._load_entries() if entry.id == memory_id), None)

    def search(
        self,
        query: str,
        scope: MemoryScope,
        limit: int = 20,
        include_expired: bool = False,
        tags: Optional[list[str]] = None,
        kind: Optional[str] = None,
    ) -> list[MemoryEntry]:
        text = query.strip().lower()
        now = datetime.now(timezone.utc)
        results: list[MemoryEntry] = []

        for entry in self._load_entries():
            if not self._matches_scope(entry, scope):
                continue
            if entry.expires_at and not include_expired:
                try:
                    if datetime.fromisoformat(entry.expires_at) <= now:
                        continue
                except ValueError:
                    continue
            if kind and entry.kind != kind:
                continue
            if tags and not all(tag in entry.tags for tag in tags):
                continue
            if text and text not in self._searchable_text(entry):
                continue
            results.append(entry)

        return list(reversed(results[-limit:]))

    def list_recent(self, scope: MemoryScope, limit: int = 20) -> list[MemoryEntry]:
        results = [entry for entry in self._load_entries() if self._matches_scope(entry, scope)]
        return list(reversed(results[-limit:]))

    def delete_or_tombstone(self, memory_id: str, reason: str, trace_id: Optional[str] = None) -> MemoryDeleteResult:
        if self.readonly:
            return MemoryDeleteResult(
                id=memory_id,
                tombstoned=False,
                reason="jsonl_memory_adapter_readonly",
                trace_id=trace_id,
            )

        tombstone = MemoryEntry(
            id=f"tombstone:{memory_id}:{uuid4()}",
            tenant_id="system",
            doctor_id="system",
            scope="system",
            kind="tombstone",
            content=reason,
            sanitized_content=reason,
            source="semantic_memory_tombstone",
            confidence=1.0,
            tags=["tombstone", memory_id],
            created_at=datetime.now(timezone.utc).isoformat(),
            trace_id=trace_id or "unknown",
            metadata={"tombstoned_id": memory_id, "reason": reason},
        )
        self.append(tombstone)
        return MemoryDeleteResult(id=memory_id, tombstoned=True, reason=reason, trace_id=trace_id)

    def healthcheck(self) -> MemoryBackendHealth:
        try:
            return MemoryBackendHealth(
                ok=True,
                backend="jsonl",
                readonly=self.readonly,
                details={
                    "file_path": str(self.file_path),
                    "exists": self.file_path.exists(),
                    "mode": "readonly" if self.readonly else "append_enabled",
                },
            )
        except Exception as exc:  # defensive healthcheck only
            return MemoryBackendHealth(ok=False, backend="jsonl", readonly=self.readonly, error=str(exc))

    def _load_entries(self) -> list[MemoryEntry]:
        if not self.file_path.exists():
            return []

        entries: list[MemoryEntry] = []
        with self.file_path.open("r", encoding="utf-8") as handle:
            for line in handle:
                if not line.strip():
                    continue
                try:
                    record = json.loads(line)
                    entries.append(self._from_record(record))
                except Exception:
                    continue
        return entries

    def _from_record(self, record: dict[str, Any]) -> MemoryEntry:
        if "sanitized_content" in record and "tenant_id" in record:
            return MemoryEntry(**record)

        content_parts = [
            self._string_value(record.get("input_summary")),
            self._string_value(record.get("model_output")),
            self._string_value(record.get("decision_output")),
            self._string_value(record.get("nlg_output")),
        ]
        content = "\n".join(part for part in content_parts if part).strip() or json.dumps(record, ensure_ascii=False)

        return MemoryEntry(
            id=self._string_value(record.get("id"))
            or self._string_value(record.get("entry_id"))
            or self._string_value(record.get("request_id"))
            or str(uuid4()),
            tenant_id=self._string_value(record.get("tenant_id")) or "legacy_unknown",
            doctor_id=self._string_value(record.get("doctor_id")) or "legacy_unknown",
            patient_id=self._string_value(record.get("patient_id")) or None,
            scope="system",
            kind="legacy_jsonl_entry",
            content=content,
            sanitized_content=content,
            source=self._string_value(record.get("source")) or "legacy_jsonl",
            confidence=float(record.get("confidence") or 0.5),
            tags=["legacy", "jsonl"],
            created_at=self._string_value(record.get("created_at"))
            or self._string_value(record.get("created_at_utc"))
            or "1970-01-01T00:00:00+00:00",
            trace_id=self._string_value(record.get("trace_id"))
            or self._string_value(record.get("request_id"))
            or "legacy_unknown",
            metadata={
                "legacy": True,
                "embedding_slot": record.get("embedding_slot"),
                "fallback_used": record.get("fallback_used"),
            },
        )

    def _matches_scope(self, entry: MemoryEntry, scope: MemoryScope) -> bool:
        if scope.scope == "system":
            return entry.scope == "system"
        if scope.tenant_id and entry.tenant_id != scope.tenant_id:
            return False
        if scope.doctor_id and entry.doctor_id != scope.doctor_id:
            return False
        if scope.patient_id and entry.patient_id != scope.patient_id:
            return False
        return entry.scope in (scope.scope, "system", "global_safe")

    def _searchable_text(self, entry: MemoryEntry) -> str:
        return " ".join(
            [
                entry.content,
                entry.sanitized_content,
                entry.kind,
                entry.source,
                " ".join(entry.tags),
            ]
        ).lower()

    def _string_value(self, value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, str):
            return value
        return json.dumps(value, ensure_ascii=False)
