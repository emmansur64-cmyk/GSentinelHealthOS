"""Alert bus for automatic system notifications.

Supported channels
------------------
- Console / structured log  (always active)
- Webhook HTTP POST          (opt-in via ALERT_WEBHOOK_URL env var)

Alert severity levels: info | warning | critical

Environment variables
---------------------
ALERT_WEBHOOK_URL               : URL to POST alerts to (optional)
ALERT_WEBHOOK_TIMEOUT_S         : seconds before webhook times out (default 3)
ALERT_REDIS_DOWN_THRESHOLD_S    : seconds before redis-down becomes critical (default 60)
ALERT_REDIS_FALLBACK_THRESHOLD  : fallback activations before alert fires (default 5)
ALERT_GROQ_FAILURES_THRESHOLD   : consecutive groq failures before alert (default 3)
ALERT_REQUEST_LATENCY_MS        : avg request latency threshold in ms (default 3000)
ALERT_DEDUP_WINDOW_S            : seconds before the same alert can fire again (default 30)
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from time import perf_counter
from typing import Any

logger = logging.getLogger("metabrain.observability.alerts")


def _env_float(key: str, default: float) -> float:
    try:
        return max(0.0, float(os.getenv(key, str(default)).strip()))
    except (TypeError, ValueError):
        return default


def _env_int(key: str, default: int) -> int:
    try:
        return max(0, int(os.getenv(key, str(default)).strip()))
    except (TypeError, ValueError):
        return default


@dataclass(frozen=True)
class AlertThresholds:
    redis_down_seconds: float = field(
        default_factory=lambda: _env_float("ALERT_REDIS_DOWN_THRESHOLD_S", 60.0)
    )
    redis_fallback_count: int = field(
        default_factory=lambda: _env_int("ALERT_REDIS_FALLBACK_THRESHOLD", 5)
    )
    groq_consecutive_failures: int = field(
        default_factory=lambda: _env_int("ALERT_GROQ_FAILURES_THRESHOLD", 3)
    )
    request_latency_ms: float = field(
        default_factory=lambda: _env_float("ALERT_REQUEST_LATENCY_MS", 3000.0)
    )
    dedup_window_seconds: float = field(
        default_factory=lambda: _env_float("ALERT_DEDUP_WINDOW_S", 30.0)
    )


@dataclass
class Alert:
    alert_type: str
    message: str
    severity: str        # info | warning | critical
    extra: dict[str, Any]
    ts: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AlertBus:
    """Central alert dispatcher with deduplication and multi-channel delivery."""

    def __init__(
        self,
        *,
        thresholds: AlertThresholds | None = None,
        webhook_url: str | None = None,
        webhook_timeout_s: float | None = None,
    ) -> None:
        self._thresholds = thresholds or AlertThresholds()
        self._webhook_url = webhook_url or os.getenv("ALERT_WEBHOOK_URL", "").strip() or None
        self._webhook_timeout = webhook_timeout_s or _env_float(
            "ALERT_WEBHOOK_TIMEOUT_S", 3.0
        )
        # Dedup: alert_type -> last fired monotonic time
        self._last_fired: dict[str, float] = {}

    async def emit(
        self,
        alert_type: str,
        *,
        message: str,
        severity: str = "warning",
        extra: dict[str, Any] | None = None,
    ) -> None:
        """Fire an alert through all configured channels, with deduplication."""
        if not self._should_fire(alert_type):
            return

        self._last_fired[alert_type] = perf_counter()
        alert = Alert(
            alert_type=alert_type,
            message=message,
            severity=severity,
            extra=extra or {},
        )

        self._emit_log(alert)

        if self._webhook_url:
            await self._emit_webhook(alert)

    def check_thresholds(self, *, metrics_snapshot: dict[str, Any]) -> list[Alert]:
        """Evaluate metrics snapshot against thresholds. Returns pending alerts.

        Call this periodically (e.g., from a background task or health endpoint)
        to detect threshold violations without a triggering event.
        """
        alerts: list[Alert] = []
        redis = metrics_snapshot.get("redis", {})
        groq = metrics_snapshot.get("groq", {})
        requests = metrics_snapshot.get("requests", {})

        degraded_s = float(redis.get("degraded_seconds", 0))
        if degraded_s >= self._thresholds.redis_down_seconds:
            alerts.append(
                Alert(
                    alert_type="redis_down_too_long",
                    message=(
                        f"Redis has been degraded for {degraded_s:.0f}s "
                        f"(threshold {self._thresholds.redis_down_seconds:.0f}s)"
                    ),
                    severity="critical",
                    extra={"degraded_seconds": degraded_s},
                )
            )

        fallback_count = int(redis.get("fallback_activations_total", 0))
        if fallback_count >= self._thresholds.redis_fallback_count:
            alerts.append(
                Alert(
                    alert_type="redis_fallback_overuse",
                    message=(
                        f"Redis fallback activated {fallback_count} times "
                        f"(threshold {self._thresholds.redis_fallback_count})"
                    ),
                    severity="warning",
                    extra={"fallback_count": fallback_count},
                )
            )

        consec = int(groq.get("consecutive_failures", 0))
        if consec >= self._thresholds.groq_consecutive_failures:
            alerts.append(
                Alert(
                    alert_type="groq_consecutive_failures",
                    message=f"Groq has failed {consec} consecutive times",
                    severity="critical",
                    extra={"consecutive_failures": consec},
                )
            )

        avg_latency = float(requests.get("avg_duration_ms", 0))
        if avg_latency >= self._thresholds.request_latency_ms:
            alerts.append(
                Alert(
                    alert_type="high_request_latency",
                    message=(
                        f"Average request latency {avg_latency:.0f}ms exceeds "
                        f"threshold {self._thresholds.request_latency_ms:.0f}ms"
                    ),
                    severity="warning",
                    extra={"avg_latency_ms": avg_latency},
                )
            )

        return alerts

    # ── Internal ─────────────────────────────────────────────────────────────

    def _should_fire(self, alert_type: str) -> bool:
        last = self._last_fired.get(alert_type)
        if last is None:
            return True
        return (perf_counter() - last) >= self._thresholds.dedup_window_seconds

    def _emit_log(self, alert: Alert) -> None:
        payload = {
            "alert_type": alert.alert_type,
            "message": alert.message,
            "severity": alert.severity,
            "ts": alert.ts,
            **alert.extra,
        }
        level_map = {
            "info": logging.INFO,
            "warning": logging.WARNING,
            "critical": logging.CRITICAL,
        }
        level = level_map.get(alert.severity, logging.WARNING)
        logger.log(level, "ALERT: %s", alert.message, extra=payload)

    async def _emit_webhook(self, alert: Alert) -> None:
        try:
            import httpx  # optional dependency

            payload = {
                "alert_type": alert.alert_type,
                "message": alert.message,
                "severity": alert.severity,
                "ts": alert.ts,
                "extra": alert.extra,
            }
            async with httpx.AsyncClient(timeout=self._webhook_timeout) as client:
                resp = await client.post(
                    self._webhook_url,  # type: ignore[arg-type]
                    content=json.dumps(payload),
                    headers={"Content-Type": "application/json"},
                )
                if resp.status_code >= 400:
                    logger.warning(
                        "alert_webhook.failed",
                        extra={
                            "status_code": resp.status_code,
                            "alert_type": alert.alert_type,
                        },
                    )
        except ImportError:
            logger.warning(
                "alert_webhook.httpx_not_available",
                extra={"alert_type": alert.alert_type},
            )
        except Exception as exc:
            logger.error(
                "alert_webhook.error",
                extra={"error": str(exc), "alert_type": alert.alert_type},
            )


# ── Module-level singleton ────────────────────────────────────────────────────
ALERT_BUS = AlertBus()
