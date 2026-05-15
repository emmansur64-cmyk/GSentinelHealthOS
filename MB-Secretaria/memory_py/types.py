from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal, Optional


MemoryScopeKind = Literal["global_safe", "tenant", "doctor", "patient", "session", "system"]


@dataclass(frozen=True)
class MemoryScope:
    scope: MemoryScopeKind
    tenant_id: Optional[str] = None
    doctor_id: Optional[str] = None
    patient_id: Optional[str] = None
    session_id: Optional[str] = None


@dataclass
class MemoryEntry:
    id: str
    tenant_id: str
    doctor_id: str
    scope: MemoryScopeKind
    kind: str
    content: str
    sanitized_content: str
    source: str
    confidence: float
    tags: list[str]
    created_at: str
    trace_id: str
    metadata: dict[str, Any] = field(default_factory=dict)
    patient_id: Optional[str] = None
    expires_at: Optional[str] = None
    audit_hash: Optional[str] = None


@dataclass(frozen=True)
class MemoryFeatureFlags:
    enabled: bool = False
    shadow_mode: bool = True
    vector_enabled: bool = False
    write_enabled: bool = False
    patient_scope_enabled: bool = False


@dataclass(frozen=True)
class MemoryBackendHealth:
    ok: bool
    backend: str
    readonly: bool
    details: dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None


@dataclass(frozen=True)
class MemoryDeleteResult:
    id: str
    tombstoned: bool
    reason: str
    trace_id: Optional[str] = None


@dataclass(frozen=True)
class MemoryAuditEvent:
    event_id: str
    timestamp: str
    trace_id: str
    action: str
    backend: str
    patient_id_present: bool
    success: bool
    fallback_used: bool
    tenant_id: Optional[str] = None
    doctor_id: Optional[str] = None
    scope: Optional[str] = None
    reason: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)
