from __future__ import annotations

import hashlib
from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from .types import MemoryAuditEvent, MemoryEntry, MemoryScope


def build_memory_audit_hash(entry: MemoryEntry) -> str:
    payload = f"{entry.id}:{entry.trace_id}:{entry.created_at}:{entry.sanitized_content}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def build_memory_audit_event(
    *,
    action: str,
    backend: str,
    trace_id: str,
    scope: Optional[MemoryScope] = None,
    success: bool,
    fallback_used: bool,
    reason: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> MemoryAuditEvent:
    return MemoryAuditEvent(
        event_id=str(uuid4()),
        timestamp=datetime.now(timezone.utc).isoformat(),
        trace_id=trace_id,
        action=action,
        backend=backend,
        patient_id_present=bool(scope and scope.patient_id),
        success=success,
        fallback_used=fallback_used,
        tenant_id=scope.tenant_id if scope else None,
        doctor_id=scope.doctor_id if scope else None,
        scope=scope.scope if scope else None,
        reason=reason,
        metadata=metadata or {},
    )


class InMemoryAuditSink:
    def __init__(self) -> None:
        self._events: list[MemoryAuditEvent] = []

    def record(self, event: MemoryAuditEvent) -> None:
        self._events.append(event)

    def recent(self, limit: int = 50) -> list[dict[str, Any]]:
        return [asdict(event) for event in self._events[-limit:]]
