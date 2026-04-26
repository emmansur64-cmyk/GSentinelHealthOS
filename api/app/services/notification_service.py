"""Notificaciones externas desacopladas (n8n webhook)."""

from __future__ import annotations

import os

import httpx

from shared.utils import setup_logger
from shared.utils.resilience import (
    CircuitBreakerConfig,
    CircuitBreakerRegistry,
    NonRetriableError,
    retry_async,
)


logger = setup_logger(__name__)


_WHATSAPP_BREAKER = CircuitBreakerRegistry.get(
    "provider.whatsapp.n8n",
    CircuitBreakerConfig(failure_threshold=4, reset_timeout_seconds=30.0, half_open_max_calls=1),
)


def _is_retryable_http_error(exc: BaseException) -> bool:
    if isinstance(exc, httpx.TimeoutException):
        return True
    if isinstance(exc, httpx.ConnectError):
        return True
    if isinstance(exc, httpx.ReadError):
        return True
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code >= 500 or exc.response.status_code == 429
    return False


async def notify_appointment_confirmation(appointment_data: dict) -> None:
    """Dispara webhook a n8n; nunca debe romper la transaccion principal."""

    n8n_url = os.getenv("N8N_WH_APPOINTMENT_CONFIRM", "").strip()
    if not n8n_url:
        return

    async def _send_once() -> None:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(n8n_url, json=appointment_data)
            if response.status_code < 500 and response.status_code not in (429,):
                response.raise_for_status()
            if response.status_code >= 400:
                response.raise_for_status()

    async def _send_with_retry() -> None:
        await retry_async(
            _send_once,
            retries=2,
            base_delay_seconds=0.5,
            max_delay_seconds=3.0,
            jitter_seconds=0.2,
            retry_predicate=_is_retryable_http_error,
        )

    try:
        await _WHATSAPP_BREAKER.call(_send_with_retry)
    except Exception as exc:
        logger.warning("whatsapp_notification_failed", extra={"error": str(exc)})
        raise
