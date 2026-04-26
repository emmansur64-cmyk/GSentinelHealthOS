"""Productor Redis para mensajes entrantes de WhatsApp."""

from __future__ import annotations

import json
from typing import Any, Dict

from redis.asyncio import Redis

from shared.config import REDIS_URL, WHATSAPP_PROCESSED_TTL_SECONDS


class WhatsAppQueueProducer:
    def __init__(self, redis_url: str = REDIS_URL, queue_name: str = "whatsapp:incoming") -> None:
        self.redis_url = redis_url
        self.queue_name = queue_name
        self._redis: Redis | None = None

    async def _client(self) -> Redis:
        if self._redis is None:
            self._redis = Redis.from_url(self.redis_url, decode_responses=True)
        return self._redis

    async def publish(self, message: Dict[str, Any]) -> bool:
        redis = await self._client()
        message_id = str(message.get("id") or message.get("message_id") or "").strip()
        if message_id:
            dedupe_key = f"processed:{message_id}"
            was_set = await redis.set(
                dedupe_key,
                "1",
                ex=WHATSAPP_PROCESSED_TTL_SECONDS,
                nx=True,
            )
            if not was_set:
                # Ya fue procesado previamente; no reenviar/reencolar.
                return False

        await redis.lpush(self.queue_name, json.dumps(message))
        return True

    async def close(self) -> None:
        if self._redis is not None:
            await self._redis.close()
            self._redis = None
