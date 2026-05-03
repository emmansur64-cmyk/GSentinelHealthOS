"""Consumidor saliente para mensajes que el Brain deja en Redis."""

from __future__ import annotations

import asyncio
import json
import time
from typing import Any

import httpx
from redis.asyncio import Redis
from redis.exceptions import RedisError

from shared.config import (
    REDIS_URL,
    WHATSAPP_DLQ_ALERT_THRESHOLD,
    WHATSAPP_DLQ_ALERT_WEBHOOK,
    WHATSAPP_OUTGOING_RATE_LIMIT,
    WHATSAPP_OUTGOING_RATE_WINDOW_SECONDS,
    WHATSAPP_PROCESSED_TTL_SECONDS,
    create_redis_master_client,
)
from shared.utils.resilience import CircuitBreakerConfig, CircuitBreakerRegistry, CircuitOpenError
from shared.utils import setup_logger

logger = setup_logger(__name__)


_OUTGOING_BREAKER = CircuitBreakerRegistry.get(
    "gateway.outgoing_consumer",
    CircuitBreakerConfig(failure_threshold=3, reset_timeout_seconds=20.0, half_open_max_calls=1),
)


class WhatsAppOutgoingConsumer:
    """Consume la cola saliente y delega el envio a WhatsAppService."""

    def __init__(
        self,
        whatsapp_service,
        *,
        account_resolver=None,
        redis_url: str = REDIS_URL,
        queue_name: str = "whatsapp:outgoing",
        redis_client: Redis | None = None,
    ) -> None:
        self.whatsapp_service = whatsapp_service
        self.account_resolver = account_resolver
        self.redis_url = redis_url
        self.queue_name = queue_name
        self.dead_letter_queue = f"{queue_name}:dead"
        self.max_retries = 5
        self.redis = redis_client
        self.running = False
        self.rate_limit = max(1, WHATSAPP_OUTGOING_RATE_LIMIT)
        self.rate_window_seconds = max(1, WHATSAPP_OUTGOING_RATE_WINDOW_SECONDS)
        self.processed_ttl_seconds = max(60, WHATSAPP_PROCESSED_TTL_SECONDS)
        self.dlq_alert_threshold = max(1, WHATSAPP_DLQ_ALERT_THRESHOLD)
        self.dlq_alert_webhook = WHATSAPP_DLQ_ALERT_WEBHOOK
        self._next_dlq_check_at = 0.0

    async def _ensure_client(self) -> Redis:
        if self.redis is None:
            self.redis = create_redis_master_client(decode_responses=True)
        return self.redis

    async def _reset_redis_client(self) -> None:
        if self.redis is None:
            return
        close_method = getattr(self.redis, "aclose", None)
        try:
            if close_method is not None:
                await close_method()
            else:
                await self.redis.close()
        finally:
            self.redis = None

    async def process_once(self, timeout: int = 5) -> bool:
        redis_client = await self._ensure_client()
        record = await redis_client.execute_command("BRPOP", self.queue_name, timeout)
        if record is None:
            await self._monitor_dlq(redis_client)
            return False

        _, raw_payload = record
        try:
            message = json.loads(raw_payload)
        except json.JSONDecodeError:
            logger.warning("Mensaje invalido en cola saliente: %s", raw_payload)
            return False

        phone = message.get("to") or message.get("phone")
        text = message.get("message") or message.get("text")
        client_id = message.get("client_id") or message.get("tenant_id")
        clinic_id = message.get("clinic_id")
        phone_number_id = message.get("phone_number_id")
        if not phone or not text:
            logger.warning("Payload saliente incompleto: %s", message)
            return False

        message_id = str(message.get("message_id") or message.get("id") or "").strip()
        if not message_id:
            # Fallback determinístico cuando no llega ID explícito.
            message_id = f"auto:{abs(hash(f'{phone}:{text}'))}"

        dedupe_key = f"processed:{message_id}"
        already_processed = await redis_client.get(dedupe_key)
        if already_processed:
            logger.info("Mensaje saliente duplicado ignorado id=%s phone=%s", message_id, phone)
            await self._monitor_dlq(redis_client)
            return True

        rate_key_phone = str(phone)
        if client_id:
            rate_key_phone = f"{client_id}:{clinic_id or 'all'}:{phone}"

        if not await self._allow_send_for_phone(redis_client, rate_key_phone):
            retries = int(message.get("_rate_retries", 0)) + 1
            message["_rate_retries"] = retries
            if retries > self.max_retries:
                await self._send_to_dlq(
                    redis_client,
                    message,
                    reason="rate_limit_exceeded",
                )
                await self._monitor_dlq(redis_client)
                return True
            await redis_client.execute_command("RPUSH", self.queue_name, json.dumps(message))
            logger.warning("Rate limit alcanzado para %s, reencolado (retry=%s)", phone, retries)
            await asyncio.sleep(0.2)
            await self._monitor_dlq(redis_client)
            return True

        resolved_access_token = None
        resolved_phone_number_id = phone_number_id
        if self.account_resolver is not None:
            account = None
            if phone_number_id:
                account = await self.account_resolver.get_by_phone_number_id(str(phone_number_id))
            if account is None and client_id:
                account = await self.account_resolver.get_by_client_id(str(client_id))
            if account is None:
                # Fallback seguro: nunca enviar con cuenta global si no se resolvió la cuenta del tenant.
                await self._send_to_dlq(
                    redis_client,
                    message,
                    reason="account_not_found_for_tenant",
                )
                logger.error(
                    "whatsapp_account_not_found_for_outgoing_message",
                    extra={"client_id": client_id, "clinic_id": clinic_id, "phone_number_id": phone_number_id},
                )
                await self._monitor_dlq(redis_client)
                return True

            resolved_access_token = account.access_token
            resolved_phone_number_id = account.phone_number_id or resolved_phone_number_id
            client_id = account.client_id or client_id
            clinic_id = getattr(account, "clinic_id", None) or clinic_id

            if not resolved_access_token:
                await self._send_to_dlq(
                    redis_client,
                    message,
                    reason="account_missing_access_token",
                )
                logger.error(
                    "whatsapp_account_missing_access_token",
                    extra={"client_id": client_id, "clinic_id": clinic_id, "phone_number_id": resolved_phone_number_id},
                )
                await self._monitor_dlq(redis_client)
                return True

        async def _send_operation() -> bool:
            send_kwargs: dict[str, Any] = {}
            if resolved_access_token:
                send_kwargs["access_token"] = resolved_access_token
            if resolved_phone_number_id:
                send_kwargs["phone_number_id"] = resolved_phone_number_id

            try:
                sent_ok = await self.whatsapp_service.send_message(str(phone), str(text), **send_kwargs)
            except TypeError:
                # Compatibilidad con stubs/tests legacy que no aceptan kwargs.
                sent_ok = await self.whatsapp_service.send_message(str(phone), str(text))
            if not sent_ok:
                raise RuntimeError("send_message devolvió False")
            return True

        try:
            await _OUTGOING_BREAKER.call(_send_operation)
        except CircuitOpenError:
            await self._send_to_dlq(redis_client, message, reason="circuit_open")
            logger.critical("Circuit breaker OPEN en outgoing_consumer. Mensaje enviado a DLQ")
            await self._monitor_dlq(redis_client)
            return True
        except Exception as exc:
            retries = int(message.get("_retries", 0)) + 1
            message["_retries"] = retries
            if retries > self.max_retries:
                await self._send_to_dlq(redis_client, message, reason=f"send_failed:{type(exc).__name__}")
                logger.error("Mensaje movido a DLQ tras reintentos agotados para %s", phone)
                await self._monitor_dlq(redis_client)
                return True

            await redis_client.execute_command("RPUSH", self.queue_name, json.dumps(message))
            logger.warning("Reencolado mensaje saliente para %s (retry=%s)", phone, retries)
            await asyncio.sleep(0.1)
            await self._monitor_dlq(redis_client)
            return True

        # Marcar procesado solo cuando efectivamente se envía.
        await redis_client.set(dedupe_key, "1", ex=self.processed_ttl_seconds, nx=True)
        logger.info(
            "Mensaje saliente procesado para %s",
            phone,
            extra={"client_id": client_id, "clinic_id": clinic_id, "phone_number_id": resolved_phone_number_id},
        )
        await self._monitor_dlq(redis_client)
        return True

    async def _allow_send_for_phone(self, redis_client: Redis, phone: str) -> bool:
        key = f"rate:outgoing:{phone}"
        current = await redis_client.incr(key)
        if current == 1:
            await redis_client.expire(key, self.rate_window_seconds)
        return int(current) <= self.rate_limit

    async def _send_to_dlq(self, redis_client: Redis, message: dict[str, Any], *, reason: str) -> None:
        payload = dict(message)
        payload["_dlq_reason"] = reason
        payload["_dlq_at"] = int(time.time())
        await redis_client.execute_command("LPUSH", self.dead_letter_queue, json.dumps(payload))

    async def _monitor_dlq(self, redis_client: Redis) -> None:
        now = time.monotonic()
        if now < self._next_dlq_check_at:
            return
        self._next_dlq_check_at = now + 5.0

        try:
            dlq_len = int(await redis_client.llen(self.dead_letter_queue))
        except Exception:
            return

        if dlq_len <= self.dlq_alert_threshold:
            return

        logger.critical(
            "DLQ threshold superado: queue=%s len=%s threshold=%s",
            self.dead_letter_queue,
            dlq_len,
            self.dlq_alert_threshold,
        )

        if not self.dlq_alert_webhook:
            return

        payload = {
            "event": "whatsapp_dlq_threshold_exceeded",
            "queue": self.dead_letter_queue,
            "length": dlq_len,
            "threshold": self.dlq_alert_threshold,
        }
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(self.dlq_alert_webhook, json=payload)
        except Exception as exc:
            logger.error("Fallo webhook de alerta DLQ: %s", exc)

    async def start(self) -> None:
        self.running = True
        logger.info("Consumidor saliente de WhatsApp escuchando %s", self.queue_name)
        while self.running:
            for delay in (2, 5, 10):
                try:
                    await self.process_once(timeout=5)
                    break
                except RedisError as exc:
                    await self._reset_redis_client()
                    logger.error(
                        "Redis no disponible en outgoing_consumer; reintento en %ss (%s)",
                        delay,
                        type(exc).__name__,
                    )
                    await asyncio.sleep(delay)
                except Exception as exc:
                    logger.exception("Error en consumidor saliente: %s", exc)
                    await asyncio.sleep(1)
                    break

    async def stop(self) -> None:
        self.running = False
        if self.redis is not None:
            close_method = getattr(self.redis, "aclose", None)
            if close_method is not None:
                await close_method()
            else:
                await self.redis.close()
            self.redis = None
