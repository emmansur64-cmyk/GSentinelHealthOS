"""Controlled semantic memory adapters for MetaBrain.

This package is intentionally not wired into the current runtime. It provides a
safe compatibility layer around the existing JSONL memory history for future
controlled activation.
"""

from .audit import build_memory_audit_event, build_memory_audit_hash
from .jsonl_adapter import JsonlMemoryAdapter
from .retriever import MemoryRetriever
from .sanitizer import MemorySanitizer
from .semantic_memory_service import SemanticMemoryService, load_memory_feature_flags
from .types import (
    MemoryAuditEvent,
    MemoryBackendHealth,
    MemoryDeleteResult,
    MemoryEntry,
    MemoryFeatureFlags,
    MemoryScope,
)

__all__ = [
    "MemoryAuditEvent",
    "MemoryBackendHealth",
    "MemoryDeleteResult",
    "MemoryEntry",
    "MemoryFeatureFlags",
    "MemoryScope",
    "JsonlMemoryAdapter",
    "MemoryRetriever",
    "MemorySanitizer",
    "SemanticMemoryService",
    "build_memory_audit_event",
    "build_memory_audit_hash",
    "load_memory_feature_flags",
]
