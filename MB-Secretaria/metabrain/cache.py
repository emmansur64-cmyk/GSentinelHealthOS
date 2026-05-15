"""Simple in-memory TTL cache to avoid repeated Groq calls."""

from __future__ import annotations

from collections import OrderedDict
from dataclasses import dataclass
from hashlib import sha256
from threading import Lock
from time import time
from typing import Any

from metabrain.config import get_settings


@dataclass
class _CacheEntry:
    value: Any
    expires_at: float


class InMemoryTTLCache:
    """Small process-local cache with TTL + max-size eviction."""

    def __init__(self, *, max_entries: int = 256, ttl_seconds: int = 300) -> None:
        self._max_entries = max(1, int(max_entries))
        self._ttl_seconds = max(1, int(ttl_seconds))
        self._lock = Lock()
        self._entries: OrderedDict[str, _CacheEntry] = OrderedDict()

    def get(self, key: str) -> Any | None:
        now = time()
        with self._lock:
            self._purge_expired_locked(now)
            entry = self._entries.get(key)
            if entry is None:
                return None
            if entry.expires_at <= now:
                self._entries.pop(key, None)
                return None

            self._entries.move_to_end(key)
            return entry.value

    def set(self, key: str, value: Any) -> None:
        now = time()
        expires_at = now + self._ttl_seconds
        with self._lock:
            self._purge_expired_locked(now)
            self._entries[key] = _CacheEntry(value=value, expires_at=expires_at)
            self._entries.move_to_end(key)
            self._evict_overflow_locked()

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()

    def size(self) -> int:
        with self._lock:
            self._purge_expired_locked(time())
            return len(self._entries)

    def _purge_expired_locked(self, now: float) -> None:
        stale_keys = [key for key, entry in self._entries.items() if entry.expires_at <= now]
        for key in stale_keys:
            self._entries.pop(key, None)

    def _evict_overflow_locked(self) -> None:
        while len(self._entries) > self._max_entries:
            self._entries.popitem(last=False)


def build_cache_key(*parts: str) -> str:
    payload = "||".join(parts)
    return sha256(payload.encode("utf-8")).hexdigest()


_GLOBAL_CACHE_LOCK = Lock()
GLOBAL_CACHE: InMemoryTTLCache | None = None


def _get_or_create_global_cache() -> InMemoryTTLCache:
    global GLOBAL_CACHE
    with _GLOBAL_CACHE_LOCK:
        if GLOBAL_CACHE is None:
            settings = get_settings()
            GLOBAL_CACHE = InMemoryTTLCache(
                max_entries=settings.nlg_cache_max_entries,
                ttl_seconds=settings.nlg_cache_ttl_seconds,
            )
    return GLOBAL_CACHE


GLOBAL_CACHE = _get_or_create_global_cache()
