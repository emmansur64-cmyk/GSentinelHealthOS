from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class ProcessedEventRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def is_processed(self, consumer_name: str, event_id: str) -> bool:
        is_postgres = self.db.bind is not None and self.db.bind.dialect.name == "postgresql"
        event_expr = ":event_id::uuid" if is_postgres else ":event_id"
        exists = await self.db.scalar(
            text(
            f"""
                SELECT 1
                FROM processed_events
                WHERE consumer_name = :consumer_name
              AND event_id = {event_expr}
                LIMIT 1
                """
            ),
            {"consumer_name": consumer_name, "event_id": event_id},
        )
        return bool(exists)

    async def mark_processed(self, consumer_name: str, event_id: str) -> None:
        is_postgres = self.db.bind is not None and self.db.bind.dialect.name == "postgresql"
        event_expr = ":event_id::uuid" if is_postgres else ":event_id"
        now_expr = "now()" if is_postgres else "CURRENT_TIMESTAMP"
        await self.db.execute(
            text(
                f"""
                INSERT INTO processed_events (consumer_name, event_id, processed_at)
                VALUES (:consumer_name, {event_expr}, {now_expr})
                ON CONFLICT (consumer_name, event_id)
                DO NOTHING
                """
            ),
            {"consumer_name": consumer_name, "event_id": event_id},
        )
