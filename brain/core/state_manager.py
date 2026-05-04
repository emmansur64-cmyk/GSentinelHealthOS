"""Gestor de estado conversacional sobre Redis."""

from __future__ import annotations

import asyncio
import json
import uuid
from contextlib import asynccontextmanager
from typing import Any

from redis.asyncio import Redis

from brain.core.config import settings
from shared.config import create_redis_master_client


class StateManager:
    """Persiste contexto corto de conversacion con TTL."""

    def __init__(
        self,
        client: Redis | None = None,
        *,
        redis_url: str | None = None,
        ttl_seconds: int | None = None,
        key_prefix: str = "chat_state",
    ) -> None:
        self._client = client or create_redis_master_client(decode_responses=True)
        self.ttl_seconds = ttl_seconds or settings.state_ttl_seconds
        self.key_prefix = key_prefix
        self._unlock_lua_script = (
            "if redis.call('get', KEYS[1]) == ARGV[1] then "
            "return redis.call('del', KEYS[1]) "
            "else return 0 end"
        )

    @staticmethod
    def _scope_phone(phone: str, clinic_id: str | None = None) -> str:
        normalized_phone = str(phone or "").strip()
        normalized_clinic = str(clinic_id or "").strip()
        if normalized_clinic:
            return f"{normalized_clinic}:{normalized_phone}"
        return normalized_phone

    def _key(self, phone: str, clinic_id: str | None = None) -> str:
        return f"{self.key_prefix}:{self._scope_phone(phone, clinic_id)}"

    @staticmethod
    def default_state() -> dict[str, Any]:
        return {"step": "idle", "context": {}}

    async def get_state(self, phone: str, clinic_id: str | None = None) -> dict[str, Any]:
        state = await self._client.get(self._key(phone, clinic_id))
        return json.loads(state) if state else self.default_state()

    async def set_state(
        self,
        phone: str,
        state: dict[str, Any],
        ttl: int | None = None,
        clinic_id: str | None = None,
    ) -> None:
        await self._client.setex(
            self._key(phone, clinic_id),
            ttl or self.ttl_seconds,
            json.dumps(state),
        )

    async def clear_state(self, phone: str, clinic_id: str | None = None) -> None:
        await self._client.delete(self._key(phone, clinic_id))

    async def incr_metric(self, metric_name: str, amount: int = 1) -> int:
        """Incrementa un contador operativo del Brain en Redis."""
        key = f"brain:metrics:{metric_name}"
        return int(await self._client.incrby(key, amount))

    async def get_metric(self, metric_name: str) -> int:
        """Lee un contador operativo del Brain en Redis."""
        key = f"brain:metrics:{metric_name}"
        value = await self._client.get(key)
        return int(value) if value is not None else 0

    async def toggle_bot_pause(self, phone: str, paused: bool, clinic_id: str | None = None) -> None:
        """Activa o desactiva el kill-switch del bot para un telefono."""
        key = f"bot_paused:{self._scope_phone(phone, clinic_id)}"
        if paused:
            await self._client.set(key, "true")
        else:
            await self._client.delete(key)

    async def is_bot_paused(self, phone: str, clinic_id: str | None = None) -> bool:
        """Indica si el bot esta pausado manualmente para un telefono."""
        return bool(await self._client.exists(f"bot_paused:{self._scope_phone(phone, clinic_id)}"))

    async def count_paused_bots(self) -> int:
        """Cuenta chats pausados que requieren atencion manual."""
        return len(await self._client.keys("bot_paused:*"))

    @asynccontextmanager
    async def conversation_lock(self, phone: str, timeout_ms: int = 5000, clinic_id: str | None = None):
        """Asegura exclusividad de procesamiento por telefono."""
        lock_key = f"lock:chat:{self._scope_phone(phone, clinic_id)}"
        token = str(uuid.uuid4())

        acquired = await self._client.set(lock_key, token, nx=True, px=timeout_ms)

        retry_count = 0
        backoff_seconds = 0.1
        while not acquired and retry_count < 3:
            await asyncio.sleep(backoff_seconds)
            acquired = await self._client.set(lock_key, token, nx=True, px=timeout_ms)
            retry_count += 1
            backoff_seconds *= 2

        if not acquired:
            yield False
            return

        try:
            yield True
        finally:
            await self._client.eval(self._unlock_lua_script, 1, lock_key, token)

    @property
    def redis_client(self) -> Redis:
        return self._client