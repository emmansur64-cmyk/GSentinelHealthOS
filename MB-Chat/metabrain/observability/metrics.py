"""Thread-safe observability metrics registry.

Tracks:
- Global HTTP request counts + latency
- Groq calls, errors, timeouts, tokens
- Pipeline stage executions and durations
- Redis connection state and fallback usage
- Circuit breaker transitions

All counters are process-local (in-memory). For multi-process deployments
expose /metrics via a shared store or Prometheus push-gateway.
"""

from __future__ import annotations

from threading import Lock
from time import perf_counter
from typing import Any


class _Counter:
    """Minimal atomic integer counter."""

    __slots__ = ("_v", "_lock")

    def __init__(self) -> None:
        self._v: int = 0
        self._lock = Lock()

    def inc(self, n: int = 1) -> None:
        with self._lock:
            self._v += max(0, n)

    def get(self) -> int:
        with self._lock:
            return self._v

    def reset(self) -> None:
        with self._lock:
            self._v = 0


class _Gauge:
    """Atomic float gauge (can increase or decrease)."""

    __slots__ = ("_v", "_lock")

    def __init__(self, initial: float = 0.0) -> None:
        self._v: float = float(initial)
        self._lock = Lock()

    def set(self, value: float) -> None:
        with self._lock:
            self._v = float(value)

    def add(self, delta: float) -> None:
        with self._lock:
            self._v += float(delta)

    def get(self) -> float:
        with self._lock:
            return self._v

    def reset(self) -> None:
        with self._lock:
            self._v = 0.0


class ObservabilityMetrics:
    """Single registry for all system observability signals."""

    def __init__(self) -> None:
        # ── HTTP / pipeline ──────────────────────────────────────────────────
        self.requests_total = _Counter()
        self.requests_error_total = _Counter()
        self.request_duration_ms = _Gauge()   # running total for average
        self._request_duration_lock = Lock()
        self._request_duration_sum: float = 0.0

        # ── Groq ─────────────────────────────────────────────────────────────
        self.groq_calls_total = _Counter()
        self.groq_errors_total = _Counter()
        self.groq_timeouts_total = _Counter()
        self.groq_auth_errors_total = _Counter()
        self.groq_empty_response_total = _Counter()
        self.groq_consecutive_failures = _Counter()   # resets on success
        self.groq_tokens_total = _Counter()
        self._groq_latency_sum: float = 0.0
        self._groq_latency_lock = Lock()

        # ── Redis ─────────────────────────────────────────────────────────────
        self.redis_connection_errors_total = _Counter()
        self.redis_circuit_opens_total = _Counter()
        self.redis_reconnect_attempts_total = _Counter()
        self.redis_recovered_total = _Counter()
        self.redis_fallback_activations_total = _Counter()
        self._redis_degraded_since: float | None = None
        self._redis_state_lock = Lock()

        # ── Pipeline stages ───────────────────────────────────────────────────
        self.pipeline_stage_counts: dict[str, int] = {}
        self.pipeline_fallback_total = _Counter()
        self._stage_lock = Lock()

    # ── HTTP helpers ─────────────────────────────────────────────────────────

    def record_request(self, *, duration_ms: float, error: bool = False) -> None:
        self.requests_total.inc()
        if error:
            self.requests_error_total.inc()
        with self._request_duration_lock:
            self._request_duration_sum += max(0.0, duration_ms)

    # ── Groq helpers ─────────────────────────────────────────────────────────

    def record_groq_success(self, *, latency_ms: float, tokens: int = 0) -> None:
        self.groq_calls_total.inc()
        self.groq_tokens_total.inc(max(0, tokens))
        with self._groq_latency_lock:
            self._groq_latency_sum += max(0.0, latency_ms)
        # Reset consecutive failure counter on success
        self.groq_consecutive_failures.reset()

    def record_groq_error(self, *, kind: str = "generic") -> None:
        self.groq_calls_total.inc()
        self.groq_errors_total.inc()
        self.groq_consecutive_failures.inc()
        if kind == "timeout":
            self.groq_timeouts_total.inc()
        elif kind == "auth":
            self.groq_auth_errors_total.inc()
        elif kind == "empty":
            self.groq_empty_response_total.inc()

    # ── Redis helpers ─────────────────────────────────────────────────────────

    def record_redis_error(self) -> None:
        self.redis_connection_errors_total.inc()

    def record_redis_circuit_open(self) -> None:
        self.redis_circuit_opens_total.inc()
        with self._redis_state_lock:
            if self._redis_degraded_since is None:
                self._redis_degraded_since = perf_counter()

    def record_redis_reconnect_attempt(self) -> None:
        self.redis_reconnect_attempts_total.inc()

    def record_redis_recovered(self) -> None:
        self.redis_recovered_total.inc()
        with self._redis_state_lock:
            self._redis_degraded_since = None

    def record_redis_fallback(self) -> None:
        self.redis_fallback_activations_total.inc()

    def redis_degraded_seconds(self) -> float:
        """Seconds since circuit first opened, or 0 if healthy."""
        with self._redis_state_lock:
            if self._redis_degraded_since is None:
                return 0.0
            return perf_counter() - self._redis_degraded_since

    # ── Pipeline helpers ──────────────────────────────────────────────────────

    def record_pipeline_stage(self, stage: str) -> None:
        with self._stage_lock:
            self.pipeline_stage_counts[stage] = self.pipeline_stage_counts.get(stage, 0) + 1

    def record_pipeline_fallback(self) -> None:
        self.pipeline_fallback_total.inc()

    # ── Snapshot ──────────────────────────────────────────────────────────────

    def snapshot(self) -> dict[str, Any]:
        req_total = self.requests_total.get()
        groq_calls = self.groq_calls_total.get()

        with self._request_duration_lock:
            avg_request_ms = (
                round(self._request_duration_sum / req_total, 2) if req_total > 0 else 0.0
            )

        with self._groq_latency_lock:
            avg_groq_latency_ms = (
                round(self._groq_latency_sum / groq_calls, 2) if groq_calls > 0 else 0.0
            )

        with self._stage_lock:
            stages = dict(self.pipeline_stage_counts)

        return {
            "requests": {
                "total": req_total,
                "errors": self.requests_error_total.get(),
                "avg_duration_ms": avg_request_ms,
            },
            "groq": {
                "calls_total": groq_calls,
                "errors_total": self.groq_errors_total.get(),
                "timeouts_total": self.groq_timeouts_total.get(),
                "auth_errors_total": self.groq_auth_errors_total.get(),
                "empty_responses_total": self.groq_empty_response_total.get(),
                "consecutive_failures": self.groq_consecutive_failures.get(),
                "tokens_total": self.groq_tokens_total.get(),
                "avg_latency_ms": avg_groq_latency_ms,
            },
            "redis": {
                "connection_errors_total": self.redis_connection_errors_total.get(),
                "circuit_opens_total": self.redis_circuit_opens_total.get(),
                "reconnect_attempts_total": self.redis_reconnect_attempts_total.get(),
                "recovered_total": self.redis_recovered_total.get(),
                "fallback_activations_total": self.redis_fallback_activations_total.get(),
                "degraded_seconds": round(self.redis_degraded_seconds(), 1),
            },
            "pipeline": {
                "fallback_total": self.pipeline_fallback_total.get(),
                "stages": stages,
            },
        }

    def to_prometheus_text(self, *, job: str = "gsentinel-brain") -> str:
        """Format the current snapshot as Prometheus text exposition format.

        Reads from snapshot() — no duplicate counters, no new state.
        """
        snap = self.snapshot()
        req = snap["requests"]
        groq = snap["groq"]
        redis = snap["redis"]
        pipeline = snap["pipeline"]

        lbl = f'{{job="{job}"}}'
        lines: list[str] = [
            "# HELP gsentinel_http_requests_total Total HTTP requests",
            "# TYPE gsentinel_http_requests_total counter",
            f"gsentinel_http_requests_total{lbl} {req['total']}",
            "",
            "# HELP gsentinel_http_errors_total Total HTTP errors",
            "# TYPE gsentinel_http_errors_total counter",
            f"gsentinel_http_errors_total{lbl} {req['errors']}",
            "",
            "# HELP gsentinel_http_avg_duration_ms Average request duration (ms)",
            "# TYPE gsentinel_http_avg_duration_ms gauge",
            f"gsentinel_http_avg_duration_ms{lbl} {req['avg_duration_ms']}",
            "",
            "# HELP gsentinel_groq_calls_total Total Groq API calls",
            "# TYPE gsentinel_groq_calls_total counter",
            f"gsentinel_groq_calls_total{lbl} {groq['calls_total']}",
            "",
            "# HELP gsentinel_groq_errors_total Total Groq errors",
            "# TYPE gsentinel_groq_errors_total counter",
            f"gsentinel_groq_errors_total{lbl} {groq['errors_total']}",
            "",
            "# HELP gsentinel_groq_timeouts_total Total Groq timeouts",
            "# TYPE gsentinel_groq_timeouts_total counter",
            f"gsentinel_groq_timeouts_total{lbl} {groq['timeouts_total']}",
            "",
            "# HELP gsentinel_groq_consecutive_failures Current consecutive Groq failures",
            "# TYPE gsentinel_groq_consecutive_failures gauge",
            f"gsentinel_groq_consecutive_failures{lbl} {groq['consecutive_failures']}",
            "",
            "# HELP gsentinel_groq_tokens_total Total tokens consumed via Groq",
            "# TYPE gsentinel_groq_tokens_total counter",
            f"gsentinel_groq_tokens_total{lbl} {groq['tokens_total']}",
            "",
            "# HELP gsentinel_groq_avg_latency_ms Average Groq API latency (ms)",
            "# TYPE gsentinel_groq_avg_latency_ms gauge",
            f"gsentinel_groq_avg_latency_ms{lbl} {groq['avg_latency_ms']}",
            "",
            "# HELP gsentinel_redis_connection_errors_total Total Redis connection errors",
            "# TYPE gsentinel_redis_connection_errors_total counter",
            f"gsentinel_redis_connection_errors_total{lbl} {redis['connection_errors_total']}",
            "",
            "# HELP gsentinel_redis_circuit_opens_total Total Redis circuit breaker opens",
            "# TYPE gsentinel_redis_circuit_opens_total counter",
            f"gsentinel_redis_circuit_opens_total{lbl} {redis['circuit_opens_total']}",
            "",
            "# HELP gsentinel_redis_degraded_seconds Seconds Redis has been in degraded state",
            "# TYPE gsentinel_redis_degraded_seconds gauge",
            f"gsentinel_redis_degraded_seconds{lbl} {redis['degraded_seconds']}",
            "",
            "# HELP gsentinel_redis_fallback_total Total Redis fallback activations",
            "# TYPE gsentinel_redis_fallback_total counter",
            f"gsentinel_redis_fallback_total{lbl} {redis['fallback_activations_total']}",
            "",
            "# HELP gsentinel_redis_recovered_total Total Redis circuit recoveries",
            "# TYPE gsentinel_redis_recovered_total counter",
            f"gsentinel_redis_recovered_total{lbl} {redis['recovered_total']}",
            "",
            "# HELP gsentinel_pipeline_fallback_total Total pipeline-level fallbacks",
            "# TYPE gsentinel_pipeline_fallback_total counter",
            f"gsentinel_pipeline_fallback_total{lbl} {pipeline['fallback_total']}",
        ]

        for stage, count in pipeline.get("stages", {}).items():
            safe_stage = stage.replace('"', "_")
            lines.append(
                f'gsentinel_pipeline_stage_total{{job="{job}",stage="{safe_stage}"}} {count}'
            )

        return "\n".join(lines) + "\n"

    def reset(self) -> None:
        """Reset all counters (useful for testing)."""
        for attr in vars(self).values():
            if isinstance(attr, (_Counter, _Gauge)):
                attr.reset()
        with self._stage_lock:
            self.pipeline_stage_counts.clear()
        with self._redis_state_lock:
            self._redis_degraded_since = None
        with self._request_duration_lock:
            self._request_duration_sum = 0.0
        with self._groq_latency_lock:
            self._groq_latency_sum = 0.0


# ── Module-level singleton ───────────────────────────────────────────────────
OBSERVABILITY_METRICS = ObservabilityMetrics()
