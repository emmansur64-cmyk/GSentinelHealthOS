from __future__ import annotations

import asyncio
import importlib
import json
import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from api.app.eventing.outbox import OutboxRepository

logger = logging.getLogger(__name__)


def _load_aio_pika() -> Any:
    try:
        return importlib.import_module("aio_pika")
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("aio-pika is required for OutboxRelay. Add aio-pika to requirements.") from exc


class OutboxRelay:
    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        rabbitmq_url: str,
        *,
        exchange_name: str = "agenda.events",
        batch_size: int = 100,
        poll_interval_seconds: float = 0.5,
        max_retries: int = 8,
    ) -> None:
        self._session_factory = session_factory
        self._rabbitmq_url = rabbitmq_url
        self._exchange_name = exchange_name
        self._batch_size = batch_size
        self._poll_interval_seconds = poll_interval_seconds
        self._max_retries = max_retries
        self._stopping = False

    async def _publish_batch(self) -> int:
        aio_pika = _load_aio_pika()

        connection = await aio_pika.connect_robust(self._rabbitmq_url)
        published = 0
        try:
            channel = await connection.channel(publisher_confirms=True)
            exchange = await channel.declare_exchange(
                self._exchange_name,
                aio_pika.ExchangeType.TOPIC,
                durable=True,
            )

            async with self._session_factory() as session:
                repo = OutboxRepository(session)
                records = await repo.claim_pending(limit=self._batch_size)
                if not records:
                    await session.rollback()
                    return 0

                for record in records:
                    try:
                        await exchange.publish(
                            aio_pika.Message(
                                body=json.dumps(record.payload).encode("utf-8"),
                                content_type="application/json",
                                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                                message_id=str(record.event_id),
                                type=record.event_type,
                            ),
                            routing_key=record.routing_key,
                        )
                        await repo.mark_published(record.id)
                        published += 1
                    except Exception as exc:
                        await repo.mark_failed(
                            outbox_id=record.id,
                            attempts=record.attempts,
                            max_retries=self._max_retries,
                            error=str(exc),
                        )
                        logger.exception("outbox_publish_failed id=%s event_id=%s", record.id, record.event_id)

                await session.commit()

            await channel.close()
        finally:
            await connection.close()

        return published

    async def run_forever(self) -> None:
        while not self._stopping:
            try:
                published = await self._publish_batch()
                if published == 0:
                    await asyncio.sleep(self._poll_interval_seconds)
            except Exception:
                logger.exception("outbox_relay_loop_error")
                await asyncio.sleep(max(1.0, self._poll_interval_seconds * 2))

    def stop(self) -> None:
        self._stopping = True
