from __future__ import annotations

from .jsonl_adapter import JsonlMemoryAdapter
from .types import MemoryEntry, MemoryScope


class MemoryRetriever:
    def __init__(self, backend: JsonlMemoryAdapter) -> None:
        self.backend = backend

    def search(self, query: str, scope: MemoryScope, limit: int = 20) -> dict[str, object]:
        entries: list[MemoryEntry] = self.backend.search(query=query, scope=scope, limit=limit)
        return {
            "entries": entries,
            "retrieval_mode": "lexical_jsonl",
        }

    def recent(self, scope: MemoryScope, limit: int = 20) -> dict[str, object]:
        return {
            "entries": self.backend.list_recent(scope=scope, limit=limit),
            "retrieval_mode": "lexical_jsonl",
        }
