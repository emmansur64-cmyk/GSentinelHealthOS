from __future__ import annotations

import asyncio

import pytest

from shared.utils.resilience import (
    CircuitBreaker,
    CircuitBreakerConfig,
    CircuitOpenError,
    retry_async,
)


@pytest.mark.asyncio
async def test_retry_async_eventually_succeeds() -> None:
    calls = {"n": 0}

    async def flaky() -> str:
        calls["n"] += 1
        if calls["n"] < 3:
            raise RuntimeError("transient")
        return "ok"

    result = await retry_async(
        flaky,
        retries=3,
        base_delay_seconds=0.01,
        max_delay_seconds=0.05,
        jitter_seconds=0.0,
    )

    assert result == "ok"
    assert calls["n"] == 3


@pytest.mark.asyncio
async def test_circuit_breaker_opens_after_threshold() -> None:
    breaker = CircuitBreaker(
        name="test.breaker",
        config=CircuitBreakerConfig(failure_threshold=2, reset_timeout_seconds=60.0, half_open_max_calls=1),
    )

    async def fail() -> None:
        raise RuntimeError("boom")

    with pytest.raises(RuntimeError):
        await breaker.call(fail)

    with pytest.raises(RuntimeError):
        await breaker.call(fail)

    with pytest.raises(CircuitOpenError):
        await breaker.call(fail)
