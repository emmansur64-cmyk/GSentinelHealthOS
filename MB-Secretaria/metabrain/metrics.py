"""Thread-safe runtime metrics for Groq usage and latency."""

from __future__ import annotations

from threading import Lock


class RuntimeMetrics:
    """Small in-process metrics registry for NLG runtime signals."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._stats: dict[str, float | int] = {
            "requests_total": 0,
            "groq_calls_total": 0,
            "groq_errors_total": 0,
            "groq_timeouts_total": 0,
            "cache_hits_total": 0,
            "cache_misses_total": 0,
            "prompt_tokens_total": 0,
            "completion_tokens_total": 0,
            "total_tokens_total": 0,
            "latency_ms_total": 0.0,
        }

    def record_request(self) -> None:
        with self._lock:
            self._stats["requests_total"] += 1

    def record_cache_hit(self) -> None:
        with self._lock:
            self._stats["cache_hits_total"] += 1

    def record_cache_miss(self) -> None:
        with self._lock:
            self._stats["cache_misses_total"] += 1

    def record_error(self) -> None:
        with self._lock:
            self._stats["groq_errors_total"] += 1

    def record_timeout(self) -> None:
        with self._lock:
            self._stats["groq_timeouts_total"] += 1

    def record_groq_call(
        self,
        *,
        latency_ms: float,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        total_tokens: int = 0,
    ) -> None:
        with self._lock:
            self._stats["groq_calls_total"] += 1
            self._stats["latency_ms_total"] = float(self._stats["latency_ms_total"]) + max(0.0, float(latency_ms))
            self._stats["prompt_tokens_total"] += max(0, int(prompt_tokens))
            self._stats["completion_tokens_total"] += max(0, int(completion_tokens))
            self._stats["total_tokens_total"] += max(0, int(total_tokens))

    def snapshot(self) -> dict[str, float | int]:
        with self._lock:
            snapshot = dict(self._stats)

        groq_calls = int(snapshot.get("groq_calls_total", 0))
        cache_lookups = int(snapshot.get("cache_hits_total", 0)) + int(snapshot.get("cache_misses_total", 0))
        avg_latency = 0.0
        if groq_calls > 0:
            avg_latency = float(snapshot.get("latency_ms_total", 0.0)) / float(groq_calls)

        hit_rate = 0.0
        if cache_lookups > 0:
            hit_rate = float(snapshot.get("cache_hits_total", 0)) / float(cache_lookups)

        snapshot["avg_latency_ms"] = round(avg_latency, 2)
        snapshot["cache_hit_rate"] = round(hit_rate, 4)
        return snapshot

    def reset(self) -> None:
        with self._lock:
            for key, value in self._stats.items():
                self._stats[key] = 0.0 if isinstance(value, float) else 0


GLOBAL_METRICS = RuntimeMetrics()
