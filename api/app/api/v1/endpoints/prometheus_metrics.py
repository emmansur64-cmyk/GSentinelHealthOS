"""Prometheus text-format metrics endpoint for GSentinelHealthOS API.

Exposes runtime telemetry collected by passive_runtime_integration_middleware
in a format that Prometheus can scrape. No external dependencies required.

Endpoint: GET /api/metrics
"""

from __future__ import annotations

import os
import platform
from fastapi import APIRouter, Request
from fastapi.responses import PlainTextResponse

router = APIRouter(tags=["observability"])

_CONTENT_TYPE = "text/plain; version=0.0.4; charset=utf-8"


def _build_prometheus_text(
    runtime_metrics: dict,
    event_bus_stats: dict,
) -> str:
    lines: list[str] = []

    requests_seen = int(runtime_metrics.get("requests_seen") or 0)
    events_published = int(runtime_metrics.get("events_published") or 0)
    shadow_executions = int(runtime_metrics.get("shadow_executions") or 0)
    last_latency_ms = float(runtime_metrics.get("last_latency_ms") or 0.0)

    bus_current = int(event_bus_stats.get("current_size") or 0)
    bus_dropped = int(event_bus_stats.get("dropped_events") or 0)

    lines += [
        "# HELP gsentinel_api_requests_total Total HTTP requests received by the API",
        "# TYPE gsentinel_api_requests_total counter",
        f"gsentinel_api_requests_total {requests_seen}",
        "",
        "# HELP gsentinel_api_events_published_total Total observability events published to in-memory bus",
        "# TYPE gsentinel_api_events_published_total counter",
        f"gsentinel_api_events_published_total {events_published}",
        "",
        "# HELP gsentinel_api_shadow_executions_total Requests processed in shadow/dry-run mode",
        "# TYPE gsentinel_api_shadow_executions_total counter",
        f"gsentinel_api_shadow_executions_total {shadow_executions}",
        "",
        "# HELP gsentinel_api_last_request_latency_ms Latency of the most recent API request (ms)",
        "# TYPE gsentinel_api_last_request_latency_ms gauge",
        f"gsentinel_api_last_request_latency_ms {last_latency_ms:.3f}",
        "",
        "# HELP gsentinel_api_event_bus_size Current events in the in-memory observability bus",
        "# TYPE gsentinel_api_event_bus_size gauge",
        f"gsentinel_api_event_bus_size {bus_current}",
        "",
        "# HELP gsentinel_api_event_bus_dropped_total Events dropped due to bus capacity limit",
        "# TYPE gsentinel_api_event_bus_dropped_total counter",
        f"gsentinel_api_event_bus_dropped_total {bus_dropped}",
        "",
        "# HELP gsentinel_api_info Static service metadata",
        "# TYPE gsentinel_api_info gauge",
        f'gsentinel_api_info{{python="{platform.python_version()}",env="{os.getenv("ENV","unknown")}"}} 1',
    ]

    return "\n".join(lines) + "\n"


@router.get("/api/metrics", include_in_schema=False)
async def prometheus_metrics(request: Request) -> PlainTextResponse:
    """Prometheus scrape endpoint — runtime telemetry in text exposition format."""
    runtime_metrics = getattr(request.app.state, "runtime_integration_metrics", {}) or {}

    # Pull event bus stats if available
    bus = getattr(request.app.state, "runtime_integration_event_bus", None)
    if bus is not None:
        stats_fn = getattr(bus, "stats", None)
        event_bus_stats = stats_fn() if callable(stats_fn) else {}
    else:
        event_bus_stats = {}

    body = _build_prometheus_text(runtime_metrics, event_bus_stats)
    return PlainTextResponse(body, media_type=_CONTENT_TYPE)
