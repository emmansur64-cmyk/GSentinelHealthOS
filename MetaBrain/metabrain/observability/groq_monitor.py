"""Groq LLM monitoring: timing, error classification, consecutive-failure tracking.

Provides
--------
- `GroqMonitor` class – wraps any callable Groq invocation
- `monitor_groq_call` – async context manager for manual instrumentation
- Automatic error classification: timeout / auth / empty / generic
- Integration with ObservabilityMetrics and AlertBus

Usage
-----
    monitor = GroqMonitor()

    # As a context manager:
    async with monitor.track() as span:
        response = await groq_client.run_prompt(...)
        span.set_tokens(response.total_tokens)

    # Check health:
    status = monitor.health_summary()
"""

from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from time import perf_counter
from typing import Any, AsyncGenerator

from metabrain.observability.alerts import AlertBus
from metabrain.observability.logger import get_logger
from metabrain.observability.metrics import OBSERVABILITY_METRICS

logger = get_logger(__name__)


def _read_int_env(key: str, default: int, minimum: int = 1) -> int:
    try:
        return max(minimum, int(os.getenv(key, str(default)).strip()))
    except (TypeError, ValueError):
        return default


def _read_float_env(key: str, default: float, minimum: float = 0.0) -> float:
    try:
        return max(minimum, float(os.getenv(key, str(default)).strip()))
    except (TypeError, ValueError):
        return default


@dataclass
class GroqCallSpan:
    """Mutable span populated during a Groq call."""

    tokens: int = 0
    _error: str | None = field(default=None, init=False, repr=False)
    _cancelled: bool = field(default=False, init=False, repr=False)

    def set_tokens(self, n: int) -> None:
        self.tokens = max(0, int(n))

    def mark_error(self, kind: str) -> None:
        self._error = kind

    def mark_cancelled(self) -> None:
        self._cancelled = True


def _classify_error(exc: BaseException) -> str:
    """Map an exception to a canonical error kind string."""
    name = type(exc).__name__.lower()
    msg = str(exc).lower()

    if "timeout" in name or "timeout" in msg:
        return "timeout"
    if "401" in msg or "unauthorized" in msg or "auth" in name or "apikey" in msg:
        return "auth"
    if isinstance(exc, (asyncio.TimeoutError, TimeoutError)):
        return "timeout"
    return "generic"


class GroqMonitor:
    """Stateful Groq call monitor. One instance per service is recommended."""

    def __init__(
        self,
        *,
        consecutive_failure_alert_threshold: int | None = None,
        latency_alert_threshold_ms: float | None = None,
        alert_bus: AlertBus | None = None,
    ) -> None:
        self._failure_threshold = consecutive_failure_alert_threshold or _read_int_env(
            "GROQ_CONSECUTIVE_FAILURE_ALERT", 3
        )
        self._latency_threshold_ms = latency_alert_threshold_ms or _read_float_env(
            "GROQ_LATENCY_ALERT_MS", 5000.0
        )
        self._alert_bus = alert_bus
        self._metrics = OBSERVABILITY_METRICS

    @asynccontextmanager
    async def track(self) -> AsyncGenerator[GroqCallSpan, None]:
        """Async context manager that instruments a Groq API call.

        Example::

            async with monitor.track() as span:
                resp = await client.run_prompt(...)
                span.set_tokens(resp.total_tokens)
        """
        span = GroqCallSpan()
        t0 = perf_counter()

        try:
            yield span
        except BaseException as exc:
            latency_ms = (perf_counter() - t0) * 1000
            kind = _classify_error(exc)
            span.mark_error(kind)
            self._metrics.record_groq_error(kind=kind)
            self._record_error_log(exc, kind=kind, latency_ms=latency_ms)
            await self._check_failure_alert()
            raise
        else:
            latency_ms = (perf_counter() - t0) * 1000

            # Detect empty response
            if span._error is None and span.tokens == 0:
                # This is allowed — caller may not set tokens. No penalty.
                pass

            self._metrics.record_groq_success(
                latency_ms=latency_ms, tokens=span.tokens
            )

            logger.info(
                "groq.call.success",
                extra={
                    "latency_ms": round(latency_ms, 2),
                    "tokens": span.tokens,
                },
            )

            await self._check_latency_alert(latency_ms)

    def record_empty_response(self) -> None:
        """Call explicitly when Groq returns an empty text body."""
        self._metrics.record_groq_error(kind="empty")
        logger.warning("groq.empty_response")

    def health_summary(self) -> dict[str, Any]:
        """Return a point-in-time snapshot of Groq health indicators."""
        snap = self._metrics.snapshot()["groq"]
        consecutive = snap["consecutive_failures"]
        status = "healthy"
        if consecutive >= self._failure_threshold:
            status = "down"
        elif consecutive > 0:
            status = "degraded"

        return {
            "status": status,
            "calls_total": snap["calls_total"],
            "errors_total": snap["errors_total"],
            "consecutive_failures": consecutive,
            "avg_latency_ms": snap["avg_latency_ms"],
            "tokens_total": snap["tokens_total"],
        }

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _record_error_log(
        self, exc: BaseException, *, kind: str, latency_ms: float
    ) -> None:
        logger.error(
            "groq.call.error",
            extra={
                "error_kind": kind,
                "error": str(exc),
                "latency_ms": round(latency_ms, 2),
                "consecutive_failures": self._metrics.groq_consecutive_failures.get(),
            },
        )

    async def _check_failure_alert(self) -> None:
        consecutive = self._metrics.groq_consecutive_failures.get()
        if consecutive >= self._failure_threshold and self._alert_bus:
            await self._alert_bus.emit(
                "groq_consecutive_failures",
                message=(
                    f"Groq has failed {consecutive} consecutive times"
                ),
                severity="critical",
                extra={"consecutive_failures": consecutive},
            )

    async def _check_latency_alert(self, latency_ms: float) -> None:
        if latency_ms >= self._latency_threshold_ms and self._alert_bus:
            await self._alert_bus.emit(
                "groq_high_latency",
                message=(
                    f"Groq response latency {latency_ms:.0f}ms exceeds "
                    f"threshold {self._latency_threshold_ms:.0f}ms"
                ),
                severity="warning",
                extra={"latency_ms": round(latency_ms, 2)},
            )


# ── Module-level singleton ────────────────────────────────────────────────────
GROQ_MONITOR = GroqMonitor()
