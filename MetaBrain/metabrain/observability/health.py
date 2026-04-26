"""FastAPI router exposing health-check and metrics endpoints.

Endpoints
---------
GET /health          – overall system health (aggregated)
GET /health/redis    – Redis circuit breaker state + ping latency
GET /health/groq     – Groq API reachability probe
GET /health/system   – host CPU / memory snapshot
GET /metrics         – full observability metrics snapshot

All health responses follow the schema::

    {
        "status":     "healthy" | "degraded" | "down",
        "latency_ms": <float>,
        "detail":     { ... }
    }

Mount this router in any FastAPI application::

    from metabrain.observability.health import build_health_router
    app.include_router(build_health_router(redis_monitor=..., groq_monitor=...))
"""

from __future__ import annotations

import asyncio
import os
import platform
from time import perf_counter
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from metabrain.observability.alerts import ALERT_BUS
from metabrain.observability.logger import get_logger
from metabrain.observability.metrics import OBSERVABILITY_METRICS

logger = get_logger(__name__)

_GROQ_PROBE_TIMEOUT_S = float(os.getenv("GROQ_HEALTH_PROBE_TIMEOUT_S", "4").strip())


def _status_code(status: str) -> int:
    return 200 if status == "healthy" else 503 if status == "down" else 207


def _health_response(status: str, latency_ms: float, detail: dict[str, Any]) -> JSONResponse:
    return JSONResponse(
        status_code=_status_code(status),
        content={
            "status": status,
            "latency_ms": round(latency_ms, 2),
            "detail": detail,
        },
    )


# ── /health/redis ─────────────────────────────────────────────────────────────

async def _check_redis(request: Request) -> JSONResponse:
    t0 = perf_counter()
    monitor = getattr(request.app.state, "redis_circuit_breaker", None)

    if monitor is None:
        latency_ms = (perf_counter() - t0) * 1000
        return _health_response(
            "degraded",
            latency_ms,
            {"reason": "redis_monitor_not_configured"},
        )

    state = monitor.state.value
    ok, ping_ms = await monitor.ping()
    latency_ms = (perf_counter() - t0) * 1000

    metrics_snap = OBSERVABILITY_METRICS.snapshot()["redis"]

    if ok and state == "closed":
        status = "healthy"
    elif ok:
        status = "degraded"
    else:
        status = "down"

    return _health_response(
        status,
        latency_ms,
        {
            "circuit_state": state,
            "ping_ms": ping_ms,
            "degraded_seconds": round(monitor.degraded_seconds(), 1),
            "connection_errors_total": metrics_snap["connection_errors_total"],
            "circuit_opens_total": metrics_snap["circuit_opens_total"],
            "fallback_activations_total": metrics_snap["fallback_activations_total"],
        },
    )


# ── /health/groq ──────────────────────────────────────────────────────────────

async def _check_groq(request: Request) -> JSONResponse:
    t0 = perf_counter()

    try:
        from groq import Groq  # type: ignore[import]

        api_key = os.getenv("GROQ_API_KEY", "").strip()
        if not api_key:
            return _health_response(
                "down",
                (perf_counter() - t0) * 1000,
                {"reason": "GROQ_API_KEY not configured"},
            )

        model = os.getenv("NLG_GROQ_MODEL", "llama3-8b-8192").strip()
        client = Groq(api_key=api_key)

        # Minimal probe: one-token completion
        completion = await asyncio.wait_for(
            asyncio.get_event_loop().run_in_executor(
                None,
                lambda: client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": "ping"}],
                    max_tokens=1,
                ),
            ),
            timeout=_GROQ_PROBE_TIMEOUT_S,
        )

        latency_ms = (perf_counter() - t0) * 1000
        responded = bool(
            completion.choices and completion.choices[0].message.content
        )

        metrics_snap = OBSERVABILITY_METRICS.snapshot()["groq"]
        return _health_response(
            "healthy" if responded else "degraded",
            latency_ms,
            {
                "model": model,
                "responded": responded,
                "consecutive_failures": metrics_snap["consecutive_failures"],
                "calls_total": metrics_snap["calls_total"],
                "avg_latency_ms": metrics_snap["avg_latency_ms"],
            },
        )

    except asyncio.TimeoutError:
        latency_ms = (perf_counter() - t0) * 1000
        return _health_response(
            "down", latency_ms, {"reason": "probe_timeout", "timeout_s": _GROQ_PROBE_TIMEOUT_S}
        )
    except ImportError:
        latency_ms = (perf_counter() - t0) * 1000
        return _health_response(
            "down", latency_ms, {"reason": "groq_sdk_not_installed"}
        )
    except Exception as exc:
        latency_ms = (perf_counter() - t0) * 1000
        error_type = type(exc).__name__
        logger.error("groq.health_probe.error", extra={"error": str(exc), "error_type": error_type})
        return _health_response(
            "down", latency_ms, {"reason": error_type, "error": str(exc)}
        )


# ── /health/system ────────────────────────────────────────────────────────────

async def _check_system(_request: Request) -> JSONResponse:
    t0 = perf_counter()
    info: dict[str, Any] = {
        "python_version": platform.python_version(),
        "platform": platform.system(),
        "cpu_count": os.cpu_count(),
    }

    try:
        import psutil  # optional

        mem = psutil.virtual_memory()
        info["memory_total_mb"] = round(mem.total / 1024 / 1024, 1)
        info["memory_available_mb"] = round(mem.available / 1024 / 1024, 1)
        info["memory_percent"] = mem.percent
        info["cpu_percent"] = psutil.cpu_percent(interval=0.1)

        # Degraded if memory > 90% or CPU > 95%
        status = "healthy"
        if mem.percent > 90 or info["cpu_percent"] > 95:
            status = "degraded"
    except ImportError:
        status = "healthy"
        info["note"] = "psutil not installed — resource metrics unavailable"

    latency_ms = (perf_counter() - t0) * 1000
    return _health_response(status, latency_ms, info)


# ── /health (aggregated) ──────────────────────────────────────────────────────

async def _check_overall(request: Request) -> JSONResponse:
    t0 = perf_counter()

    redis_resp = await _check_redis(request)
    groq_resp = await _check_groq(request)
    system_resp = await _check_system(request)

    redis_data = redis_resp.body
    groq_data = groq_resp.body
    system_data = system_resp.body

    import json

    redis_status = json.loads(redis_data)["status"]
    groq_status = json.loads(groq_data)["status"]
    system_status = json.loads(system_data)["status"]

    statuses = [redis_status, groq_status, system_status]
    if "down" in statuses:
        overall = "down"
    elif "degraded" in statuses:
        overall = "degraded"
    else:
        overall = "healthy"

    latency_ms = (perf_counter() - t0) * 1000

    # Evaluate alert thresholds on current metrics
    pending_alerts = ALERT_BUS.check_thresholds(
        metrics_snapshot=OBSERVABILITY_METRICS.snapshot()
    )

    return _health_response(
        overall,
        latency_ms,
        {
            "components": {
                "redis": redis_status,
                "groq": groq_status,
                "system": system_status,
            },
            "active_alerts": [
                {"type": a.alert_type, "severity": a.severity, "message": a.message}
                for a in pending_alerts
            ],
        },
    )


# ── /metrics ──────────────────────────────────────────────────────────────────

async def _get_metrics(_request: Request) -> JSONResponse:
    snap = OBSERVABILITY_METRICS.snapshot()
    return JSONResponse(status_code=200, content=snap)


# ── Router factory ────────────────────────────────────────────────────────────

def build_health_router(*, prefix: str = "") -> APIRouter:
    """Return an APIRouter with all observability endpoints.

    Parameters
    ----------
    prefix : str
        Optional URL prefix (e.g. "/api/v1").
    """
    router = APIRouter(tags=["observability"])

    router.add_api_route(
        f"{prefix}/health",
        _check_overall,
        methods=["GET"],
        summary="Overall system health",
    )
    router.add_api_route(
        f"{prefix}/health/redis",
        _check_redis,
        methods=["GET"],
        summary="Redis circuit breaker health",
    )
    router.add_api_route(
        f"{prefix}/health/groq",
        _check_groq,
        methods=["GET"],
        summary="Groq API reachability",
    )
    router.add_api_route(
        f"{prefix}/health/system",
        _check_system,
        methods=["GET"],
        summary="Host system resources",
    )
    router.add_api_route(
        f"{prefix}/metrics",
        _get_metrics,
        methods=["GET"],
        summary="Full observability metrics snapshot",
    )

    return router
