from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import json
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.app.eventing.schemas import DomainEvent


@dataclass
class OutboxRecord:
    id: int
    event_id: UUID
    event_type: str
    routing_key: str
    payload: dict[str, Any]
    attempts: int


class OutboxRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def enqueue(self, event: DomainEvent) -> None:
        payload = event.model_dump(mode="json")
        is_postgres = self.db.bind is not None and self.db.bind.dialect.name == "postgresql"
        payload_expr = ":payload::jsonb" if is_postgres else ":payload"
        now_expr = "now()" if is_postgres else "CURRENT_TIMESTAMP"

        db_payload: Any = payload if is_postgres else json.dumps(payload)

        await self.db.execute(
            text(
                f"""
                INSERT INTO outbox_events (
                    event_id, event_type, routing_key, aggregate_type, aggregate_id, payload,
                    status, attempts, max_retries, next_attempt_at
                ) VALUES (
                    :event_id, :event_type, :routing_key, :aggregate_type, :aggregate_id, {payload_expr},
                    'pending', 0, 8, {now_expr}
                )
                """
            ),
            {
                "event_id": str(event.event_id),
                "event_type": event.event_type,
                "routing_key": event.routing_key(),
                "aggregate_type": event.aggregate_type,
                "aggregate_id": event.aggregate_id,
                "payload": db_payload,
            },
        )

    async def enqueue_many(self, events: list[DomainEvent]) -> None:
        for event in events:
            await self.enqueue(event)

    async def claim_pending(self, limit: int = 100) -> list[OutboxRecord]:
        is_postgres = self.db.bind is not None and self.db.bind.dialect.name == "postgresql"
        now_expr = "now()" if is_postgres else "CURRENT_TIMESTAMP"
        lock_clause = "FOR UPDATE SKIP LOCKED" if is_postgres else ""

        rows = await self.db.execute(
            text(
                f"""
                SELECT id, event_id, event_type, routing_key, payload, attempts
                FROM outbox_events
                WHERE status = 'pending'
                  AND next_attempt_at <= {now_expr}
                ORDER BY created_at ASC
                LIMIT :limit
                {lock_clause}
                """
            ),
            {"limit": limit},
        )

        records: list[OutboxRecord] = []
        for row in rows:
            raw_payload = row.payload
            parsed_payload = json.loads(raw_payload) if isinstance(raw_payload, str) else dict(raw_payload)
            records.append(
                OutboxRecord(
                    id=int(row.id),
                    event_id=UUID(str(row.event_id)),
                    event_type=str(row.event_type),
                    routing_key=str(row.routing_key),
                    payload=parsed_payload,
                    attempts=int(row.attempts),
                )
            )
        return records

    async def mark_published(self, outbox_id: int) -> None:
        is_postgres = self.db.bind is not None and self.db.bind.dialect.name == "postgresql"
        now_expr = "now()" if is_postgres else "CURRENT_TIMESTAMP"
        await self.db.execute(
            text(
                f"""
                UPDATE outbox_events
                SET status = 'published',
                    published_at = {now_expr},
                    updated_at = {now_expr}
                WHERE id = :id
                """
            ),
            {"id": outbox_id},
        )

    async def mark_failed(self, outbox_id: int, attempts: int, max_retries: int, error: str) -> None:
        is_dead = attempts + 1 >= max_retries
        is_postgres = self.db.bind is not None and self.db.bind.dialect.name == "postgresql"
        now_expr = "now()" if is_postgres else "CURRENT_TIMESTAMP"
        await self.db.execute(
            text(
                f"""
                UPDATE outbox_events
                SET attempts = attempts + 1,
                    status = CASE WHEN :is_dead THEN 'dead' ELSE 'pending' END,
                    next_attempt_at = CASE
                        WHEN :is_dead THEN next_attempt_at
                        ELSE :next_attempt_at
                    END,
                    last_error = :last_error,
                    updated_at = {now_expr}
                WHERE id = :id
                """
            ),
            {
                "id": outbox_id,
                "is_dead": is_dead,
                "next_attempt_at": datetime.now(timezone.utc) + timedelta(seconds=min(64, 2 ** min(6, attempts + 1))),
                "last_error": error[:2000],
            },
        )

    async def outbox_lag_seconds(self) -> float:
        is_postgres = self.db.bind is not None and self.db.bind.dialect.name == "postgresql"
        if not is_postgres:
            return 0.0
        value = await self.db.scalar(
            text(
                """
                SELECT EXTRACT(EPOCH FROM (now() - MIN(created_at)))
                FROM outbox_events
                WHERE status = 'pending'
                """
            )
        )
        return float(value or 0.0)
