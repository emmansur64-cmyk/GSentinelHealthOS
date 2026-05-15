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

    @property
    def enabled(self) -> bool:
        return self._settings.enabled

    async def publish(self, payload: dict[str, object]) -> None:
        if not self._settings.enabled:
            raise RuntimeError("async_bus_disabled")

        import aio_pika

        connection = await aio_pika.connect_robust(self._settings.broker_url)
        try:
            channel = await connection.channel()
            queue = await channel.declare_queue(self._settings.queue_name, durable=True)
            message = aio_pika.Message(
                body=json.dumps(payload, ensure_ascii=True).encode("utf-8"),
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                content_type="application/json",
            )
            await channel.default_exchange.publish(message, routing_key=queue.name)
        finally:
            await connection.close()
