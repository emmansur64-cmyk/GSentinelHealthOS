from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field


class EmbeddingSlot(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    embedding_id: str
    status: str
    model_name: str
    dimensions: int | None = None
    vector_ref: str | None = None
    created_at_utc: datetime


class MemoryHistoryEntry(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    entry_id: str
    request_id: str
    source: str
    created_at_utc: datetime
    input_summary: dict[str, Any]
    model_output: dict[str, Any]
    decision_output: dict[str, Any]
    nlg_output: dict[str, Any]
    fallback_used: bool
    embedding_slot: EmbeddingSlot


class MemoryHistoryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    total_in_memory: int = Field(..., ge=0)
    items: list[MemoryHistoryEntry]


def build_embedding_slot(source: str) -> EmbeddingSlot:
    return EmbeddingSlot(
        embedding_id=str(uuid4()),
        status="pending",
        model_name="reserved_for_future_embedding_model",
        dimensions=None,
        vector_ref=f"memory_embeddings/{source}/{uuid4()}",
        created_at_utc=datetime.now(timezone.utc),
    )
