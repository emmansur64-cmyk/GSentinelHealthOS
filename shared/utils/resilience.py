"""Resilience primitives for external providers.

Includes:
- Async circuit breaker (process-local)
- Exponential backoff retry helper
"""

from __future__ import annotations

import asyncio
import random
import time
from dataclasses import dataclass
from collections import deque
from typing import Any, Awaitable, Callable, Optional, TypeVar

from shared.utils import setup_logger


logger = setup_logger(__name__)

T = TypeVar("T")


class CircuitOpenError(RuntimeError):
    """Raised when a circuit breaker is open and short-circuits requests."""


class NonRetriableError(RuntimeError):
    """Raised to stop retries immediately for non-transient failures."""


@dataclass
class CircuitBreakerConfig:
    """Circuit breaker tuning values."""

    failure_threshold: int = 5
    reset_timeout_seconds: float = 30.0
    half_open_max_calls: int = 1


class CircuitBreaker:
    """Simple async-safe circuit breaker for provider calls."""

    def __init__(self, name: str, config: CircuitBreakerConfig):
        self.name = name
        self.config = config
        self._failures = 0
        self._opened_at: float | None = None
        self._half_open_calls = 0
        self._opened_total = 0
        self._short_circuit_total = 0
        self._lock = asyncio.Lock()

    async def _before_call(self) -> None:
        async with self._lock:
            if self._opened_at is None:
                return

            elapsed = time.monotonic() - self._opened_at
            if elapsed < self.config.reset_timeout_seconds:
                self._short_circuit_total += 1
                raise CircuitOpenError(
                    f"Circuit {self.name} open; retry in {self.config.reset_timeout_seconds - elapsed:.2f}s"
                )

            # Move to half-open state.
            if self._half_open_calls >= self.config.half_open_max_calls:
                self._short_circuit_total += 1
                raise CircuitOpenError(f"Circuit {self.name} half-open saturation")
            self._half_open_calls += 1

    async def snapshot(self) -> dict[str, Any]:
        """Return current breaker state for health/observability."""
        async with self._lock:
            state = "closed"
            open_for_seconds = 0.0
            retry_after_seconds = 0.0

            if self._opened_at is not None:
                elapsed = max(0.0, time.monotonic() - self._opened_at)
                if elapsed >= self.config.reset_timeout_seconds:
                    state = "half_open"
                else:
                    state = "open"
                open_for_seconds = elapsed
                retry_after_seconds = max(0.0, self.config.reset_timeout_seconds - elapsed)

            return {
                "name": self.name,
                "state": state,
                "failures": self._failures,
                "failure_threshold": self.config.failure_threshold,
                "open_for_seconds": round(open_for_seconds, 3),
                "retry_after_seconds": round(retry_after_seconds, 3),
                "half_open_max_calls": self.config.half_open_max_calls,
                "half_open_calls": self._half_open_calls,
                "opened_total": self._opened_total,
                "short_circuit_total": self._short_circuit_total,
            }

    async def _on_success(self) -> None:
        async with self._lock:
            self._failures = 0
            self._opened_at = None
            self._half_open_calls = 0

    async def _on_failure(self, exc: BaseException) -> None:
        async with self._lock:
            self._failures += 1
            if self._failures >= self.config.failure_threshold:
                was_open = self._opened_at is not None
                self._opened_at = time.monotonic()
                self._half_open_calls = 0
                if not was_open:
                    self._opened_total += 1
                logger.warning(
                    "circuit_opened",
                    extra={
                        "circuit": self.name,
                        "failures": self._failures,
                        "error": str(exc),
                    },
                )

    async def call(self, operation: Callable[[], Awaitable[T]]) -> T:
        """Execute operation if circuit allows it."""
        await self._before_call()
        try:
            result = await operation()
        except Exception as exc:
            await self._on_failure(exc)
            raise
        await self._on_success()
        return result


class CircuitBreakerRegistry:
    """Registry for named breakers."""

    _breakers: dict[str, CircuitBreaker] = {}

    @classmethod
    def get(cls, name: str, config: Optional[CircuitBreakerConfig] = None) -> CircuitBreaker:
        if name not in cls._breakers:
            cls._breakers[name] = CircuitBreaker(name=name, config=config or CircuitBreakerConfig())
        return cls._breakers[name]

    @classmethod
    async def snapshot_all(cls) -> dict[str, dict[str, Any]]:
        result: dict[str, dict[str, Any]] = {}
        for name, breaker in cls._breakers.items():
            result[name] = await breaker.snapshot()
        return result


class AsyncRateLimiter:
    """Simple sliding-window async rate limiter.

    Limits the amount of operations in a time window (default 1 second).
    """

    def __init__(self, max_calls: int, period_seconds: float = 1.0):
        self.max_calls = max(1, int(max_calls))
        self.period_seconds = max(0.001, float(period_seconds))
        self._calls: deque[float] = deque()
        self._lock = asyncio.Lock()
        self._throttled_total = 0
        self._total_acquires = 0

    async def acquire(self) -> None:
        while True:
            sleep_for = 0.0
            async with self._lock:
                now = time.monotonic()

                while self._calls and (now - self._calls[0]) >= self.period_seconds:
                    self._calls.popleft()

                if len(self._calls) < self.max_calls:
                    self._calls.append(now)
                    self._total_acquires += 1
                    return

                oldest = self._calls[0]
                sleep_for = max(0.0, self.period_seconds - (now - oldest))
                self._throttled_total += 1

            if sleep_for > 0:
                await asyncio.sleep(sleep_for)

    async def snapshot(self) -> dict[str, Any]:
        async with self._lock:
            return {
                "max_calls": self.max_calls,
                "period_seconds": self.period_seconds,
                "throttled_total": self._throttled_total,
                "total_acquires": self._total_acquires,
            }


async def retry_async(
    operation: Callable[[], Awaitable[T]],
    *,
    retries: int,
    base_delay_seconds: float,
    max_delay_seconds: float,
    jitter_seconds: float = 0.0,
    retry_predicate: Optional[Callable[[BaseException], bool]] = None,
    on_retry: Optional[Callable[[BaseException, int, float], None]] = None,
) -> T:
    """Retry async operation using exponential backoff."""
    attempt = 0
    while True:
        try:
            return await operation()
        except NonRetriableError:
            raise
        except Exception as exc:
            should_retry = attempt < retries
            if retry_predicate is not None and not retry_predicate(exc):
                should_retry = False

            if not should_retry:
                raise

            delay = min(max_delay_seconds, base_delay_seconds * (2 ** attempt))
            if jitter_seconds > 0:
                delay += random.uniform(0.0, jitter_seconds)
            if on_retry is not None:
                on_retry(exc, attempt + 1, max(0.0, delay))
            await asyncio.sleep(max(0.0, delay))
            attempt += 1
