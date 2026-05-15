from __future__ import annotations

import json
import threading
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from cerebro_ai_med.memory.schemas import MemoryHistoryEntry, MemoryHistoryResponse, build_embedding_slot


class MemoryHistoryStore:
    def __init__(self, file_path: str, max_in_memory: int = 500) -> None:
        self._file_path = Path(file_path)
        self._file_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._buffer: deque[MemoryHistoryEntry] = deque(maxlen=max_in_memory)

    def append(
        self,
        *,
        request_id: str,
        source: str,
        input_summary: dict[str, object],
        model_output: dict[str, object],
        decision_output: dict[str, object],
        nlg_output: dict[str, object],
        fallback_used: bool,
    ) -> MemoryHistoryEntry:
        entry = MemoryHistoryEntry(
            entry_id=str(uuid4()),
            request_id=request_id,
            source=source,
            created_at_utc=datetime.now(timezone.utc),
            input_summary=input_summary,
            model_output=model_output,
            decision_output=decision_output,
            nlg_output=nlg_output,
            fallback_used=fallback_used,
            embedding_slot=build_embedding_slot(source=source),
        )

        payload = entry.model_dump(mode="json")

        with self._lock:
            self._buffer.append(entry)
            with self._file_path.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(payload, ensure_ascii=True))
                fh.write("\n")

        return entry

    def recent(self, limit: int = 20) -> MemoryHistoryResponse:
        safe_limit = max(1, min(limit, 200))
        with self._lock:
            items = list(self._buffer)[-safe_limit:]

        return MemoryHistoryResponse(total_in_memory=len(self._buffer), items=items)
