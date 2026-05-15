from collections import deque
from collections.abc import Mapping
import threading
import time

from .types import ObservabilityEvent


DEFAULT_MAX_EVENTS = 1000
DEFAULT_TTL_SECONDS = 900
DEFAULT_TTL_ENABLED = False


def resolve_event_bus_max_events(env: Mapping[str, str] | None = None) -> int:
    """Resolve bounded in-memory event retention for shadow-mode telemetry."""
    source = env or {}
    raw_value = source.get("OBSERVABILITY_EVENT_BUS_MAX_EVENTS")
    if raw_value is None:
        return DEFAULT_MAX_EVENTS
    try:
        value = int(str(raw_value).strip())
    except (TypeError, ValueError):
        return DEFAULT_MAX_EVENTS
    return value if value > 0 else DEFAULT_MAX_EVENTS


def resolve_event_bus_ttl_enabled(env: Mapping[str, str] | None = None) -> bool:
    source = env or {}
    raw_value = source.get("OBSERVABILITY_EVENT_BUS_TTL_ENABLED")
    if raw_value is None:
        return DEFAULT_TTL_ENABLED

    normalized = str(raw_value).strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return DEFAULT_TTL_ENABLED


def resolve_event_bus_ttl_seconds(env: Mapping[str, str] | None = None) -> int:
    source = env or {}
    raw_value = source.get("OBSERVABILITY_EVENT_BUS_TTL_SECONDS")
    if raw_value is None:
        return DEFAULT_TTL_SECONDS
    try:
        value = int(str(raw_value).strip())
    except (TypeError, ValueError):
        return DEFAULT_TTL_SECONDS
    return value if value > 0 else DEFAULT_TTL_SECONDS


class InMemoryObservabilityEventBus:
    """Bounded shadow-mode only non-production telemetry buffer."""

    def __init__(
        self,
        max_events: int = DEFAULT_MAX_EVENTS,
        ttl_enabled: bool = DEFAULT_TTL_ENABLED,
        ttl_seconds: int = DEFAULT_TTL_SECONDS,
    ) -> None:
        self._max_events = max(1, int(max_events))
        self._events: deque[tuple[float, ObservabilityEvent]] = deque(maxlen=self._max_events)
        self._ttl_enabled = bool(ttl_enabled)
        self._ttl_seconds = max(1, int(ttl_seconds))
        self._lock = threading.RLock()
        self._published_events = 0
        self._dropped_events = 0
        self._expired_events = 0

    def publish(self, event: ObservabilityEvent) -> None:
        now = time.time()
        with self._lock:
            self._cleanup_expired_locked(now)
            if len(self._events) >= self._max_events:
                self._dropped_events += 1
            self._events.append((now, event))
            self._published_events += 1

    def list(self) -> list[ObservabilityEvent]:
        now = time.time()
        with self._lock:
            self._cleanup_expired_locked(now)
            return [event for _, event in self._events]

    def stats(self) -> dict[str, int]:
        now = time.time()
        with self._lock:
            self._cleanup_expired_locked(now)
            return {
                "current_size": len(self._events),
                "max_size": self._max_events,
                "dropped_events": self._dropped_events,
            }

    def diagnostics(self) -> dict[str, int | bool]:
        """Extended counters for local validation without changing public stats shape."""
        now = time.time()
        with self._lock:
            self._cleanup_expired_locked(now)
            return {
                "current_size": len(self._events),
                "max_size": self._max_events,
                "dropped_events": self._dropped_events,
                "expired_events": self._expired_events,
                "published_events": self._published_events,
                "ttl_enabled": self._ttl_enabled,
                "ttl_seconds": self._ttl_seconds,
            }

    def _cleanup_expired_locked(self, now: float) -> int:
        if not self._ttl_enabled:
            return 0

        removed = 0
        expiry_cutoff = now - self._ttl_seconds
        while self._events and self._events[0][0] <= expiry_cutoff:
            self._events.popleft()
            removed += 1

        if removed > 0:
            self._expired_events += removed
        return removed
