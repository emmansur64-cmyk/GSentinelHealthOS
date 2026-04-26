"""Servicio de cola Redis para reservas de turnos."""

from __future__ import annotations

import json
import inspect
import uuid
import zlib
from datetime import datetime, timezone
from typing import Any, Optional

from redis.asyncio import Redis

from api.app.core import settings
from api.app.schemas import AppointmentCreate


class BookingQueueService:
    """Encola reservas y permite consultar resultados asincronos."""

    REQUEST_KEY_PREFIX = "appointments:booking:request"
    IDEMPOTENCY_KEY_PREFIX = "appointments:booking:idemp"
    QUEUE_KEY_PREFIX = "appointments:booking:shard"

    def __init__(self, redis_url: Optional[str] = None) -> None:
        self.redis_url = redis_url or settings.redis_url
        self.shards = max(1, settings.booking_queue_shards)
        self.result_ttl_seconds = settings.booking_queue_result_ttl_seconds

    async def _redis(self) -> Redis:
        return Redis.from_url(self.redis_url, decode_responses=True)

    @staticmethod
    async def _redis_call(result: Any) -> Any:
        if inspect.isawaitable(result):
            return await result
        return result

    @staticmethod
    def _normalize_datetime(value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def build_slot_key(self, doctor_id: uuid.UUID, appointment_time: datetime) -> str:
        normalized = self._normalize_datetime(appointment_time)
        return f"{doctor_id}|{normalized.isoformat()}"

    def _shard_for_slot(self, slot_key: str) -> int:
        return zlib.crc32(slot_key.encode("utf-8")) % self.shards

    def _queue_key(self, shard: int) -> str:
        return f"{self.QUEUE_KEY_PREFIX}:{shard}"

    def _request_key(self, request_id: str) -> str:
        return f"{self.REQUEST_KEY_PREFIX}:{request_id}"

    def _idempotency_key(self, key: str) -> str:
        return f"{self.IDEMPOTENCY_KEY_PREFIX}:{key}"

    async def enqueue(
        self,
        appointment_data: AppointmentCreate,
        created_by: str,
        idempotency_key: str,
    ) -> dict[str, Any]:
        slot_key = self.build_slot_key(appointment_data.doctor_id, appointment_data.date_time)
        shard = self._shard_for_slot(slot_key)

        redis = await self._redis()
        try:
            idem_key = self._idempotency_key(idempotency_key)
            existing_request_id = await self._redis_call(redis.get(idem_key))
            if existing_request_id:
                return {
                    "accepted": True,
                    "request_id": existing_request_id,
                    "slot_key": slot_key,
                    "shard": shard,
                    "replayed": True,
                }

            request_id = str(uuid.uuid4())
            request_key = self._request_key(request_id)
            payload = {
                "request_id": request_id,
                "doctor_id": str(appointment_data.doctor_id),
                "patient_id": str(appointment_data.patient_id),
                "date_time": self._normalize_datetime(appointment_data.date_time).isoformat(),
                "reason": appointment_data.reason or "",
                "status": appointment_data.status,
                "created_by": created_by,
                "slot_key": slot_key,
                "idempotency_key": idempotency_key,
            }

            was_set = await self._redis_call(redis.set(idem_key, request_id, nx=True, ex=self.result_ttl_seconds))
            if not was_set:
                concurrent_request_id = await self._redis_call(redis.get(idem_key))
                return {
                    "accepted": True,
                    "request_id": concurrent_request_id,
                    "slot_key": slot_key,
                    "shard": shard,
                    "replayed": True,
                }

            await self._redis_call(redis.hset(
                request_key,
                mapping={
                    "status": "queued",
                    "status_code": "202",
                    "response_json": json.dumps({"detail": "Solicitud encolada"}),
                    "slot_key": slot_key,
                    "created_at": datetime.utcnow().isoformat(),
                },
            ))
            await self._redis_call(redis.expire(request_key, self.result_ttl_seconds))
            await self._redis_call(redis.lpush(self._queue_key(shard), json.dumps(payload)))

            return {
                "accepted": True,
                "request_id": request_id,
                "slot_key": slot_key,
                "shard": shard,
                "replayed": False,
            }
        finally:
            close_fn = getattr(redis, "aclose", None) or redis.close
            await close_fn()

    async def get_result(self, request_id: str) -> Optional[dict[str, Any]]:
        redis = await self._redis()
        try:
            raw = await self._redis_call(redis.hgetall(self._request_key(request_id)))
            if not raw:
                return None
            return {
                "request_id": request_id,
                "status": raw.get("status", "unknown"),
                "status_code": int(raw.get("status_code", "500")),
                "response": json.loads(raw.get("response_json", "{}")),
                "slot_key": raw.get("slot_key"),
                "created_at": raw.get("created_at"),
                "completed_at": raw.get("completed_at"),
            }
        finally:
            close_fn = getattr(redis, "aclose", None) or redis.close
            await close_fn()
