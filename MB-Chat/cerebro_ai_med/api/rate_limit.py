from __future__ import annotations

import time
from dataclasses import dataclass

from redis.asyncio import Redis


@dataclass(frozen=True)
class RateLimitDecision:
    allowed: bool
    limit: int
    remaining: int
    reset_seconds: int


class RedisRateLimiter:
    def __init__(self, redis: Redis, requests: int, window_seconds: int) -> None:
        self._redis = redis
        self._requests = requests
        self._window_seconds = window_seconds

    async def close(self) -> None:
        await self._redis.aclose()

    async def ping(self) -> bool:
        pong = await self._redis.ping()
        return bool(pong)

    async def evaluate(self, identity: str) -> RateLimitDecision:
        epoch_window = int(time.time() // self._window_seconds)
        key = f"cerebro:ratelimit:{identity}:{epoch_window}"

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
        )


async def build_redis_rate_limiter(redis_url: str, requests: int, window_seconds: int) -> RedisRateLimiter:
    redis = Redis.from_url(redis_url, encoding="utf-8", decode_responses=True)
    await redis.ping()
    return RedisRateLimiter(redis=redis, requests=requests, window_seconds=window_seconds)
