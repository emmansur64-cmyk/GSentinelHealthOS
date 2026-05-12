"""Global rate limiting helpers for the FastAPI API."""

from __future__ import annotations

import hashlib
import ipaddress
import os
import threading
import time
from collections import OrderedDict
from collections.abc import Mapping
from dataclasses import dataclass

from fastapi import Request
from redis.asyncio import Redis
from redis.exceptions import RedisError

from shared.utils import setup_logger

logger = setup_logger(__name__)

DEFAULT_FALLBACK_MAX_KEYS = 4096
DEFAULT_DEGRADED_RESET_SECONDS = 60
DEGRADED_WARNING_INTERVAL_SECONDS = 60.0


@dataclass(frozen=True)
class RateLimitDecision:
    allowed: bool
    limit: int
    remaining: int
    reset_seconds: int
    degraded: bool = False
    backend: str = "disabled"


@dataclass(frozen=True)
class RateLimitRuntimeConfig:
    enabled: bool
    redis_required: bool
    fallback_in_memory: bool
    trusted_proxy_enabled: bool
    trusted_proxy_cidrs: tuple[str, ...]
    trusted_proxy_ips: tuple[str, ...]
    fallback_max_keys: int = DEFAULT_FALLBACK_MAX_KEYS


def _read_bool(env: Mapping[str, str], name: str, default: bool) -> bool:
    value = env.get(name)
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _read_csv(env: Mapping[str, str], name: str) -> tuple[str, ...]:
    value = env.get(name)
    if value is None:
        return ()
    return tuple(part.strip() for part in str(value).split(",") if part.strip())


def load_rate_limit_runtime_config(env: Mapping[str, str] | None = None) -> RateLimitRuntimeConfig:
    source = env if env is not None else os.environ
    return RateLimitRuntimeConfig(
        enabled=_read_bool(source, "RATE_LIMIT_ENABLED", True),
        redis_required=_read_bool(source, "RATE_LIMIT_REDIS_REQUIRED", False),
        fallback_in_memory=_read_bool(source, "RATE_LIMIT_FALLBACK_IN_MEMORY", True),
        trusted_proxy_enabled=_read_bool(source, "TRUSTED_PROXY_ENABLED", False),
        trusted_proxy_cidrs=_read_csv(source, "TRUSTED_PROXY_CIDRS"),
        trusted_proxy_ips=_read_csv(source, "TRUSTED_PROXY_IPS"),
        fallback_max_keys=max(1, int(source.get("RATE_LIMIT_FALLBACK_MAX_KEYS", DEFAULT_FALLBACK_MAX_KEYS))),
    )


def _normalize_identity(value: str | None) -> str:
    normalized = (value or "unknown").strip().lower()
    return normalized[:128] or "unknown"


def _identity_digest(identity: str) -> str:
    normalized = _normalize_identity(identity)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:24]


def _trusted_proxy_match(remote_addr: str, config: RateLimitRuntimeConfig) -> bool:
    if not config.trusted_proxy_enabled or not remote_addr:
        return False

    try:
        remote_ip = ipaddress.ip_address(remote_addr)
    except ValueError:
        return remote_addr in config.trusted_proxy_ips

    if remote_addr in config.trusted_proxy_ips:
        return True

    for cidr in config.trusted_proxy_cidrs:
        try:
            if remote_ip in ipaddress.ip_network(cidr, strict=False):
                return True
        except ValueError:
            continue
    return False


def resolve_rate_limit_identity(
    request: Request,
    config: RateLimitRuntimeConfig | None = None,
    env: Mapping[str, str] | None = None,
) -> str:
    runtime_config = config if config is not None else load_rate_limit_runtime_config(env)
    remote_addr = _normalize_identity(getattr(request.client, "host", None))

    if _trusted_proxy_match(remote_addr, runtime_config):
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            client_ip = _normalize_identity(forwarded_for.split(",")[0])
            if client_ip:
                return client_ip

    return remote_addr


class InMemoryRateLimiter:
    def __init__(self, requests: int, window_seconds: int, max_keys: int = DEFAULT_FALLBACK_MAX_KEYS) -> None:
        self._requests = max(1, int(requests))
        self._window_seconds = max(1, int(window_seconds))
        self._max_keys = max(1, int(max_keys))
        self._entries: OrderedDict[str, tuple[int, float]] = OrderedDict()
        self._lock = threading.RLock()

    async def close(self) -> None:
        return None

    async def evaluate(self, identity: str) -> RateLimitDecision:
        now = time.time()
        epoch_window = int(now // self._window_seconds)
        expires_at = float((epoch_window + 1) * self._window_seconds)
        key = self._build_key(identity, epoch_window)

        with self._lock:
            self._cleanup_locked(now)
            current, _ = self._entries.get(key, (0, expires_at))
            current += 1
            self._entries[key] = (current, expires_at)
            self._entries.move_to_end(key)
            while len(self._entries) > self._max_keys:
                self._entries.popitem(last=False)

        reset_seconds = max(1, int(expires_at - now))
        remaining = max(self._requests - current, 0)
        return RateLimitDecision(
            allowed=current <= self._requests,
            limit=self._requests,
            remaining=remaining,
            reset_seconds=reset_seconds,
            backend="memory",
        )

    def diagnostics(self) -> dict[str, int]:
        now = time.time()
        with self._lock:
            self._cleanup_locked(now)
            return {
                "current_keys": len(self._entries),
                "max_keys": self._max_keys,
            }

    def _build_key(self, identity: str, epoch_window: int) -> str:
        return f"mem:{_identity_digest(identity)}:{epoch_window}"

    def _cleanup_locked(self, now: float) -> None:
        expired_keys = [
            key
            for key, (_, expires_at) in self._entries.items()
            if expires_at <= now
        ]
        for key in expired_keys:
            self._entries.pop(key, None)


class RedisRateLimiter:
    def __init__(
        self,
        redis: Redis | None,
        requests: int,
        window_seconds: int,
        *,
        config: RateLimitRuntimeConfig | None = None,
        fallback: InMemoryRateLimiter | None = None,
    ) -> None:
        self._redis = redis
        self._requests = max(1, int(requests))
        self._window_seconds = max(1, int(window_seconds))
        self._config = config if config is not None else load_rate_limit_runtime_config()
        self._fallback = fallback
        self._last_warning_at = 0.0

    async def close(self) -> None:
        if self._redis is not None:
            await self._redis.aclose()
        if self._fallback is not None:
            await self._fallback.close()

    async def evaluate(self, identity: str) -> RateLimitDecision:
        if not self._config.enabled:
            return RateLimitDecision(
                allowed=True,
                limit=0,
                remaining=0,
                reset_seconds=0,
                backend="disabled",
            )

        if self._redis is not None:
            try:
                return await self._evaluate_redis(identity)
            except (RedisError, OSError, TimeoutError) as exc:
                await self._handle_redis_failure(exc, phase="request")

        return await self._evaluate_degraded(identity)

    async def _evaluate_redis(self, identity: str) -> RateLimitDecision:
        epoch_window = int(time.time() // self._window_seconds)
        key = f"gsentinel:ratelimit:v1:{_identity_digest(identity)}:{epoch_window}"

        current = await self._redis.incr(key)
        if current == 1:
            await self._redis.expire(key, self._window_seconds)

        ttl = await self._redis.ttl(key)
        reset_seconds = ttl if isinstance(ttl, int) and ttl > 0 else self._window_seconds
        remaining = max(self._requests - int(current), 0)
        return RateLimitDecision(
            allowed=int(current) <= self._requests,
            limit=self._requests,
            remaining=remaining,
            reset_seconds=reset_seconds,
            backend="redis",
        )

    async def _evaluate_degraded(self, identity: str) -> RateLimitDecision:
        if self._fallback is not None:
            decision = await self._fallback.evaluate(identity)
            return RateLimitDecision(
                allowed=decision.allowed,
                limit=decision.limit,
                remaining=decision.remaining,
                reset_seconds=decision.reset_seconds,
                degraded=True,
                backend="memory-fallback",
            )

        return RateLimitDecision(
            allowed=True,
            limit=self._requests,
            remaining=self._requests,
            reset_seconds=self._window_seconds,
            degraded=True,
            backend="degraded-open",
        )

    async def _handle_redis_failure(self, exc: Exception, *, phase: str) -> None:
        now = time.time()
        if now - self._last_warning_at >= DEGRADED_WARNING_INTERVAL_SECONDS:
            log_fn = logger.error if self._config.redis_required else logger.warning
            log_fn(
                "rate_limit_redis_unavailable phase=%s redis_required=%s fallback_in_memory=%s error_type=%s",
                phase,
                self._config.redis_required,
                self._fallback is not None,
                type(exc).__name__,
            )
            self._last_warning_at = now

        redis = self._redis
        self._redis = None
        if redis is not None:
            try:
                await redis.aclose()
            except (RedisError, OSError, TimeoutError):
                return None


async def build_redis_rate_limiter(redis_url: str, requests: int, window_seconds: int) -> RedisRateLimiter:
    config = load_rate_limit_runtime_config()
    fallback = None
    if config.enabled and config.fallback_in_memory:
        fallback = InMemoryRateLimiter(
            requests=requests,
            window_seconds=window_seconds,
            max_keys=config.fallback_max_keys,
        )

    if not config.enabled:
        return RedisRateLimiter(
            redis=None,
            requests=requests,
            window_seconds=window_seconds,
            config=config,
            fallback=None,
        )

    redis = None
    try:
        redis = Redis.from_url(redis_url, encoding="utf-8", decode_responses=True)
        await redis.ping()
    except (RedisError, OSError, TimeoutError) as exc:
        if redis is not None:
            try:
                await redis.aclose()
            except (RedisError, OSError, TimeoutError):
                pass
        log_fn = logger.error if config.redis_required else logger.warning
        log_fn(
            "rate_limit_redis_unavailable phase=startup redis_required=%s fallback_in_memory=%s error_type=%s",
            config.redis_required,
            fallback is not None,
            type(exc).__name__,
        )
        redis = None

    return RedisRateLimiter(
        redis=redis,
        requests=requests,
        window_seconds=window_seconds,
        config=config,
        fallback=fallback,
    )
