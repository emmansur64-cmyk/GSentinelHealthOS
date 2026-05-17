from __future__ import annotations

import json
from dataclasses import dataclass


@dataclass(frozen=True)
class AsyncBusSettings:
    enabled: bool
    broker_url: str
    queue_name: str


class AsyncAnalyzeBus:
    def __init__(self, settings: AsyncBusSettings) -> None:
        self._settings = settings
        self._connection = None
        self._channel = None
        self._queue_name: str | None = None

    @property
    def enabled(self) -> bool:
        return self._settings.enabled

    async def _ensure_channel(self):
        import aio_pika

        if self._connection is None or self._connection.is_closed:
            self._connection = await aio_pika.connect_robust(self._settings.broker_url)
            self._channel = await self._connection.channel()
            queue = await self._channel.declare_queue(self._settings.queue_name, durable=True)
            self._queue_name = queue.name
        elif self._channel is None or self._channel.is_closed:
            self._channel = await self._connection.channel()
            queue = await self._channel.declare_queue(self._settings.queue_name, durable=True)
            self._queue_name = queue.name

    async def publish(self, payload: dict[str, object]) -> None:
        if not self._settings.enabled:
            raise RuntimeError("async_bus_disabled")

        import aio_pika

        try:
            await self._ensure_channel()
            message = aio_pika.Message(
                body=json.dumps(payload, ensure_ascii=True).encode("utf-8"),
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                content_type="application/json",
            )
            assert self._channel is not None
            assert self._queue_name is not None
            await self._channel.default_exchange.publish(message, routing_key=self._queue_name)
        except Exception:
            self._channel = None
            self._queue_name = None
            if self._connection is not None:
                await self._connection.close()
                self._connection = None
            raise

    async def aclose(self) -> None:
        if self._channel is not None and not self._channel.is_closed:
            await self._channel.close()
        if self._connection is not None and not self._connection.is_closed:
            await self._connection.close()
        self._channel = None
        self._connection = None
        self._queue_name = None
