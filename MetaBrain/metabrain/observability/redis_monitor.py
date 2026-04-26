"""Redis circuit breaker with observability hooks and auto-recovery.

States
------
CLOSED   – normal operation, requests pass through
OPEN     – Redis unreachable, requests skip Redis immediately
HALF_OPEN – probe attempt after recovery_interval_seconds

Environment variables
---------------------
REDIS_CB_FAILURE_THRESHOLD  : failures before opening circuit       (default 3)
REDIS_CB_RECOVERY_SECONDS   : seconds to wait before HALF_OPEN probe (default 30)
REDIS_CB_PROBE_TIMEOUT_S    : seconds for a single ping probe        (default 2)

Usage
-----
    monitor = RedisCircuitBreaker(redis_url="redis://localhost:6379")
    await monitor.start()                 # starts background recovery loop
    async with monitor.guard():           # raises CircuitOpenError if OPEN
        await do_redis_operation(...)
    await monitor.stop()
"""

from __future__ import annotations

import asyncio
import os
from enum import Enum
from time import perf_counter
from typing import AsyncGenerator

from metabrain.observability.alerts import AlertBus
from metabrain.observability.logger import get_logger
from metabrain.observability.metrics import OBSERVABILITY_METRICS

logger = get_logger(__name__)


class CircuitState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitOpenError(RuntimeError):
    """Raised when a call is blocked by an open circuit breaker."""


def _read_int_env(key: str, default: int, minimum: int = 1) -> int:
    try:
        return max(minimum, int(os.getenv(key, str(default)).strip()))
    except (TypeError, ValueError):
        return default


def _read_float_env(key: str, default: float, minimum: float = 0.1) -> float:
    try:
        return max(minimum, float(os.getenv(key, str(default)).strip()))
    except (TypeError, ValueError):
        return default


class RedisCircuitBreaker:
    """Async circuit breaker that wraps a Redis connection with state management."""

    def __init__(
        self,
        *,
        redis_url: str,
        failure_threshold: int | None = None,
        recovery_interval_seconds: float | None = None,
        probe_timeout_seconds: float | None = None,
        alert_bus: AlertBus | None = None,
    ) -> None:
        self._redis_url = redis_url
        self._failure_threshold = failure_threshold or _read_int_env(
            "REDIS_CB_FAILURE_THRESHOLD", 3
        )
        self._recovery_interval = recovery_interval_seconds or _read_float_env(
            "REDIS_CB_RECOVERY_SECONDS", 30.0
        )
        self._probe_timeout = probe_timeout_seconds or _read_float_env(
            "REDIS_CB_PROBE_TIMEOUT_S", 2.0
        )
        self._alert_bus = alert_bus
        self._metrics = OBSERVABILITY_METRICS

        self._state: CircuitState = CircuitState.CLOSED
        self._consecutive_failures: int = 0
        self._opened_at: float | None = None
        self._lock = asyncio.Lock()
        self._recovery_task: asyncio.Task | None = None  # type: ignore[type-arg]
        self._redis_client = None

    # ── Public interface ──────────────────────────────────────────────────────

    @property
    def state(self) -> CircuitState:
        return self._state

    @property
    def is_open(self) -> bool:
        return self._state == CircuitState.OPEN

    def degraded_seconds(self) -> float:
        if self._opened_at is None:
            return 0.0
        return perf_counter() - self._opened_at

    async def start(self) -> None:
        """Start background recovery loop."""
        await self._ensure_redis_client()
        self._recovery_task = asyncio.ensure_future(self._recovery_loop())
        logger.info("redis_monitor.started", extra={"redis_url": self._redis_url})

    async def stop(self) -> None:
        """Stop the background recovery loop and close the Redis client."""
        if self._recovery_task is not None:
            self._recovery_task.cancel()
            try:
                await self._recovery_task
            except asyncio.CancelledError:
                pass
        if self._redis_client is not None:
            try:
                await self._redis_client.aclose()
            except Exception:
                pass
        logger.info("redis_monitor.stopped")

    async def guard(self) -> AsyncGenerator[None, None]:
        """Async context manager. Raises CircuitOpenError if circuit is OPEN."""
        if self._state == CircuitState.OPEN:
            raise CircuitOpenError(
                f"Redis circuit OPEN — degraded for {self.degraded_seconds():.1f}s"
            )
        try:
            yield
        except Exception as exc:
            await self._on_failure(exc, source="guard")
            raise

    async def record_success(self) -> None:
        """Call after a successful Redis operation to close/reset the circuit."""
        async with self._lock:
            await self._transition_to_closed(source="record_success")

    async def record_failure(self, exc: Exception, *, source: str = "external") -> None:
        """Call after a failed Redis operation."""
        await self._on_failure(exc, source=source)

    async def reset_circuit_manual(self) -> None:
        """Force circuit to CLOSED (admin / manual recovery hook)."""
        async with self._lock:
            logger.warning(
                "redis.circuit.manual_reset",
                extra={"previous_state": self._state.value},
            )
            self._state = CircuitState.CLOSED
            self._consecutive_failures = 0
            self._opened_at = None
            self._metrics.record_redis_recovered()

    # ── Health ping ───────────────────────────────────────────────────────────

    async def ping(self) -> tuple[bool, float]:
        """Ping Redis and return (ok, latency_ms)."""
        t0 = perf_counter()
        try:
            client = await self._ensure_redis_client()
            await asyncio.wait_for(client.ping(), timeout=self._probe_timeout)
            latency = (perf_counter() - t0) * 1000
            return True, round(latency, 2)
        except Exception:
            latency = (perf_counter() - t0) * 1000
            return False, round(latency, 2)

    # ── Internal state machine ────────────────────────────────────────────────

    async def _on_failure(self, exc: Exception, *, source: str) -> None:
        async with self._lock:
            self._consecutive_failures += 1
            self._metrics.record_redis_error()

            logger.error(
                "redis.connection.error",
                extra={
                    "source": source,
                    "error": str(exc),
                    "consecutive_failures": self._consecutive_failures,
                },
            )

            if (
                self._consecutive_failures >= self._failure_threshold
                and self._state != CircuitState.OPEN
            ):
                await self._transition_to_open(source=source)

    async def _transition_to_open(self, *, source: str) -> None:
        """Must be called inside _lock."""
        self._state = CircuitState.OPEN
        self._opened_at = perf_counter()
        self._metrics.record_redis_circuit_open()

        logger.warning(
            "redis.circuit.open",
            extra={
                "source": source,
                "consecutive_failures": self._consecutive_failures,
                "failure_threshold": self._failure_threshold,
            },
        )

        if self._alert_bus:
            await self._alert_bus.emit(
                "redis_circuit_open",
                message=(
                    f"Redis circuit OPEN after {self._consecutive_failures} consecutive failures"
                ),
                severity="critical",
                extra={"source": source},
            )

    async def _transition_to_closed(self, *, source: str) -> None:
        """Must be called inside _lock."""
        was_degraded = self._state in (CircuitState.OPEN, CircuitState.HALF_OPEN)
        self._state = CircuitState.CLOSED
        self._consecutive_failures = 0
        self._opened_at = None
        self._metrics.record_redis_recovered()

        if was_degraded:
            logger.info("redis.recovered", extra={"source": source})
            if self._alert_bus:
                await self._alert_bus.emit(
                    "redis_recovered",
                    message="Redis connection recovered",
                    severity="info",
                    extra={"source": source},
                )

    # ── Background recovery loop ──────────────────────────────────────────────

    async def _recovery_loop(self) -> None:
        """Periodically probe Redis when circuit is OPEN and attempt recovery."""
        while True:
            try:
                await asyncio.sleep(self._recovery_interval)

                if self._state != CircuitState.OPEN:
                    continue

                async with self._lock:
                    self._state = CircuitState.HALF_OPEN
                    self._metrics.record_redis_reconnect_attempt()

                logger.info(
                    "redis.circuit.reset.attempt",
                    extra={"degraded_seconds": round(self.degraded_seconds(), 1)},
                )

                ok, latency_ms = await self.ping()

                async with self._lock:
                    if ok:
                        await self._transition_to_closed(source="recovery_loop")
                    else:
                        # Back to OPEN
                        self._state = CircuitState.OPEN
                        logger.warning(
                            "redis.circuit.probe_failed",
                            extra={"latency_ms": latency_ms},
                        )
            except asyncio.CancelledError:
                return
            except Exception as exc:
                logger.error(
                    "redis_monitor.recovery_loop_error",
                    extra={"error": str(exc)},
                    exc_info=True,
                )

    # ── Redis client factory ──────────────────────────────────────────────────

    async def _ensure_redis_client(self):  # noqa: ANN
        if self._redis_client is not None:
            return self._redis_client
        try:
            from redis.asyncio import Redis  # type: ignore[import]

            self._redis_client = Redis.from_url(
                self._redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=self._probe_timeout,
                socket_timeout=self._probe_timeout,
            )
        except ImportError as exc:
            raise RuntimeError(
                "redis[asyncio] is required for RedisCircuitBreaker"
            ) from exc
        return self._redis_client
