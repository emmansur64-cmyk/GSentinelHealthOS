from __future__ import annotations

from typing import Any

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("fastapi.testclient")

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient
from redis.exceptions import RedisError
from starlette.requests import Request as StarletteRequest

from api.app.services import rate_limit as rate_limit_module
from api.app.services.rate_limit import (
    InMemoryRateLimiter,
    RateLimitRuntimeConfig,
    RedisRateLimiter,
    build_redis_rate_limiter,
    resolve_rate_limit_identity,
)


RATE_LIMIT_ENV_KEYS = [
    "RATE_LIMIT_ENABLED",
    "RATE_LIMIT_REDIS_REQUIRED",
    "RATE_LIMIT_FALLBACK_IN_MEMORY",
    "RATE_LIMIT_FALLBACK_MAX_KEYS",
    "TRUSTED_PROXY_ENABLED",
    "TRUSTED_PROXY_CIDRS",
    "TRUSTED_PROXY_IPS",
]


class StartupFailingRedis:
    async def ping(self) -> None:
        raise RedisError("startup-unavailable")

    async def aclose(self) -> None:
        return None


class RequestFailingRedis:
    async def incr(self, key: str) -> int:
        raise RedisError(f"request-unavailable:{key}")

    async def expire(self, key: str, seconds: int) -> bool:
        return True

    async def ttl(self, key: str) -> int:
        return 60

    async def aclose(self) -> None:
        return None


@pytest.fixture(autouse=True)
def clear_rate_limit_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for key in RATE_LIMIT_ENV_KEYS:
        monkeypatch.delenv(key, raising=False)


def _build_request(remote_host: str, forwarded_for: str | None = None) -> StarletteRequest:
    headers: list[tuple[bytes, bytes]] = []
    if forwarded_for is not None:
        headers.append((b"x-forwarded-for", forwarded_for.encode("utf-8")))
    scope: dict[str, Any] = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "raw_path": b"/",
        "headers": headers,
        "client": (remote_host, 4321),
        "server": ("testserver", 80),
        "scheme": "http",
        "query_string": b"",
        "root_path": "",
        "http_version": "1.1",
    }
    return StarletteRequest(scope)


def _runtime_config(**overrides: Any) -> RateLimitRuntimeConfig:
    baseline = {
        "enabled": True,
        "redis_required": False,
        "fallback_in_memory": True,
        "trusted_proxy_enabled": False,
        "trusted_proxy_cidrs": (),
        "trusted_proxy_ips": (),
        "fallback_max_keys": 128,
    }
    baseline.update(overrides)
    return RateLimitRuntimeConfig(**baseline)


def _build_rate_limit_app(limiter: RedisRateLimiter) -> FastAPI:
    app = FastAPI()

    @app.middleware("http")
    async def rate_limit_middleware(request: Request, call_next):
        decision = await limiter.evaluate(resolve_rate_limit_identity(request))
        if not decision.allowed:
            return JSONResponse(status_code=429, content={"detail": "rate_limit_exceeded"})

        response = await call_next(request)
        if decision.backend != "disabled":
            response.headers["X-RateLimit-Limit"] = str(decision.limit)
            response.headers["X-RateLimit-Remaining"] = str(decision.remaining)
            response.headers["X-RateLimit-Reset"] = str(decision.reset_seconds)
            response.headers["X-RateLimit-Backend"] = decision.backend
            if decision.degraded:
                response.headers["X-RateLimit-Degraded"] = "true"
        return response

    @app.get("/")
    async def root() -> dict[str, bool]:
        return {"ok": True}

    return app


@pytest.mark.asyncio
async def test_redis_unavailable_at_startup_does_not_break_build(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    monkeypatch.setenv("RATE_LIMIT_FALLBACK_IN_MEMORY", "true")
    monkeypatch.setenv("RATE_LIMIT_REDIS_REQUIRED", "false")
    monkeypatch.setattr(
        rate_limit_module.Redis,
        "from_url",
        staticmethod(lambda *args, **kwargs: StartupFailingRedis()),
    )

    limiter = await build_redis_rate_limiter("redis://unavailable:6379", requests=2, window_seconds=60)
    decision = await limiter.evaluate("198.51.100.9")

    assert decision.allowed is True
    assert decision.degraded is True
    assert decision.backend == "memory-fallback"


def test_redis_failure_during_request_returns_200_with_degraded_headers() -> None:
    limiter = RedisRateLimiter(
        redis=RequestFailingRedis(),
        requests=5,
        window_seconds=60,
        config=_runtime_config(fallback_in_memory=False),
        fallback=None,
    )
    app = _build_rate_limit_app(limiter)

    with TestClient(app) as client:
        response = client.get("/", headers={"Authorization": "Bearer secret-token"})

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert response.headers["X-RateLimit-Backend"] == "degraded-open"
    assert response.headers["X-RateLimit-Degraded"] == "true"
    assert "Authorization" not in response.headers


@pytest.mark.asyncio
async def test_in_memory_fallback_limits_requests_correctly() -> None:
    limiter = RedisRateLimiter(
        redis=RequestFailingRedis(),
        requests=2,
        window_seconds=60,
        config=_runtime_config(fallback_in_memory=True),
        fallback=InMemoryRateLimiter(requests=2, window_seconds=60, max_keys=32),
    )

    first = await limiter.evaluate("198.51.100.10")
    second = await limiter.evaluate("198.51.100.10")
    third = await limiter.evaluate("198.51.100.10")

    assert first.allowed is True
    assert second.allowed is True
    assert third.allowed is False
    assert third.backend == "memory-fallback"
    assert third.degraded is True


def test_x_forwarded_for_is_ignored_without_trusted_proxy() -> None:
    request = _build_request(remote_host="198.51.100.7", forwarded_for="203.0.113.25")

    identity = resolve_rate_limit_identity(
        request,
        config=_runtime_config(trusted_proxy_enabled=False),
    )

    assert identity == "198.51.100.7"


def test_x_forwarded_for_is_accepted_only_for_trusted_proxy() -> None:
    request = _build_request(remote_host="198.51.100.7", forwarded_for="203.0.113.25")

    identity = resolve_rate_limit_identity(
        request,
        config=_runtime_config(
            trusted_proxy_enabled=True,
            trusted_proxy_cidrs=("198.51.100.0/24",),
        ),
    )

    assert identity == "203.0.113.25"


@pytest.mark.asyncio
async def test_in_memory_fallback_cleanup_stays_bounded(monkeypatch: pytest.MonkeyPatch) -> None:
    clock = {"now": 1000.0}
    monkeypatch.setattr(rate_limit_module.time, "time", lambda: clock["now"])
    limiter = InMemoryRateLimiter(requests=1, window_seconds=10, max_keys=3)

    await limiter.evaluate("198.51.100.1")
    await limiter.evaluate("198.51.100.2")
    await limiter.evaluate("198.51.100.3")
    await limiter.evaluate("198.51.100.4")
    assert limiter.diagnostics()["current_keys"] <= 3

    clock["now"] = 1025.0
    await limiter.evaluate("198.51.100.9")
    assert limiter.diagnostics()["current_keys"] == 1
