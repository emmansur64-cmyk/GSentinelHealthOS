"""Worker de reservas: consume cola Redis y procesa turnos de forma segura."""

from __future__ import annotations

import asyncio
import inspect
import json
from datetime import datetime
from typing import Any, Optional

from fastapi import HTTPException
from redis.asyncio import Redis

from api.app.core import settings
from api.app.db.session import async_session_local
from api.app.schemas import AppointmentCreate
from api.app.services.appointment_service import AppointmentService
from shared.utils import setup_logger


logger = setup_logger(__name__)


class BookingQueueWorker:
    """Consume shards de cola y crea turnos con lock distribuido por slot."""

    QUEUE_KEY_PREFIX = "appointments:booking:shard"
    REQUEST_KEY_PREFIX = "appointments:booking:request"
    LOCK_KEY_PREFIX = "appointments:booking:lock"
    HEARTBEAT_KEY_PREFIX = "appointments:booking:worker"

    def __init__(
        self,
        *,
        redis_url: Optional[str] = None,
        shard: int = 0,
    ) -> None:
        self.redis_url = redis_url or settings.redis_url
        self.shard = shard
        self.lock_ttl_ms = settings.booking_queue_lock_ttl_ms
        self.result_ttl_seconds = settings.booking_queue_result_ttl_seconds
        self.running = False
        self._redis: Optional[Redis] = None

    def _queue_key(self) -> str:
        return f"{self.QUEUE_KEY_PREFIX}:{self.shard}"

    def _heartbeat_key(self) -> str:
        return f"{self.HEARTBEAT_KEY_PREFIX}:{self.shard}:heartbeat"

    @staticmethod
    def _request_key(request_id: str) -> str:
        return f"{BookingQueueWorker.REQUEST_KEY_PREFIX}:{request_id}"

    @staticmethod
    def _lock_key(slot_key: str) -> str:
        return f"{BookingQueueWorker.LOCK_KEY_PREFIX}:{slot_key}"

    async def _redis_client(self) -> Redis:
        if self._redis is None:
            self._redis = Redis.from_url(self.redis_url, decode_responses=True)
        return self._redis

    @staticmethod
    async def _redis_call(result: Any) -> Any:
        if inspect.isawaitable(result):
            return await result
        return result

    async def _acquire_lock(self, slot_key: str, owner: str) -> bool:
        redis = await self._redis_client()
        return bool(await self._redis_call(redis.set(self._lock_key(slot_key), owner, nx=True, px=self.lock_ttl_ms)))

    async def _release_lock(self, slot_key: str, owner: str) -> None:
        redis = await self._redis_client()
        script = """
if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
else
    return 0
end
"""
        await self._redis_call(redis.eval(script, 1, [self._lock_key(slot_key), owner]))

    async def _save_result(
        self,
        request_id: str,
        status_value: str,
        status_code: int,
        payload: dict[str, Any],
        slot_key: str,
    ) -> None:
        redis = await self._redis_client()
        key = self._request_key(request_id)
        await self._redis_call(redis.hset(
            key,
            mapping={
                "status": status_value,
                "status_code": str(status_code),
                "response_json": json.dumps(payload),
                "slot_key": slot_key,
                "completed_at": datetime.utcnow().isoformat(),
            },
        ))
        await self._redis_call(redis.expire(key, self.result_ttl_seconds))

    async def process_once(self, timeout_seconds: int = 5) -> bool:
        redis = await self._redis_client()
        await self._redis_call(
            redis.set(
                self._heartbeat_key(),
                datetime.utcnow().isoformat(),
                ex=max(10, timeout_seconds * 3),
            )
        )
        item = await redis.execute_command("BRPOP", self._queue_key(), timeout_seconds)
        if item is None:
            return False

        _, raw_payload = item
        event = json.loads(raw_payload)
        request_id = event["request_id"]
        slot_key = event["slot_key"]
        owner = f"booking-worker:{self.shard}:{request_id}"

        if not await self._acquire_lock(slot_key, owner):
            await self._redis_call(redis.lpush(self._queue_key(), raw_payload))
            await asyncio.sleep(0.05)
            return True

        try:
            appointment_data = AppointmentCreate(
                doctor_id=event["doctor_id"],
                patient_id=event["patient_id"],
                date_time=event["date_time"],
                reason=event.get("reason") or None,
                status=event.get("status") or "scheduled",
            )
            created_by = event.get("created_by", "queue")

            async with async_session_local() as session:
                service = AppointmentService(session)
                try:
                    appointment = await service.create_appointment(
                        appointment_data=appointment_data,
                        created_by=created_by,
                    )
                    await self._save_result(
                        request_id=request_id,
                        status_value="completed",
                        status_code=200,
                        payload=appointment.model_dump(mode="json"),
                        slot_key=slot_key,
                    )
                except HTTPException as exc:
                    await self._save_result(
                        request_id=request_id,
                        status_value="failed",
                        status_code=exc.status_code,
                        payload={"detail": exc.detail},
                        slot_key=slot_key,
                    )
                except Exception as exc:
                    logger.exception("Error no controlado en worker de reservas: %s", exc)
                    await self._save_result(
                        request_id=request_id,
                        status_value="failed",
                        status_code=500,
                        payload={"detail": "Error interno procesando reserva"},
                        slot_key=slot_key,
                    )
        finally:
            await self._release_lock(slot_key, owner)

        return True

    async def start(self) -> None:
        self.running = True
        logger.info("BookingQueueWorker escuchando shard=%s", self.shard)
        while self.running:
            try:
                await self.process_once(timeout_seconds=5)
            except Exception as exc:
                logger.exception("Fallo en loop de BookingQueueWorker shard=%s: %s", self.shard, exc)
                await asyncio.sleep(1)

    async def stop(self) -> None:
        self.running = False
        if self._redis is not None:
            close_fn = getattr(self._redis, "aclose", None) or self._redis.close
            await self._redis_call(close_fn())
            self._redis = None
