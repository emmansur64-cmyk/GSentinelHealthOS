"""Passive runtime wiring for future MetaBrain integration.

This module must never change request or response bodies. It only creates
sanitized in-memory telemetry and safety-gate snapshots for validation.
"""

from __future__ import annotations

import os
import time
from dataclasses import asdict, dataclass, is_dataclass
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, Request

from shared.utils import setup_logger

logger = setup_logger(__name__)


SENSITIVE_HEADER_MARKERS = ("authorization", "cookie", "token", "secret", "key")
TRACE_HEADER = "x-trace-id"
CORRELATION_HEADER = "x-correlation-id"
TENANT_HEADER = "x-tenant-id"


@dataclass
class _FallbackObservabilityFlags:
    enabled: bool
    external_export_enabled: bool
    phi_allowed: bool


@dataclass
class _FallbackRuntimeGuard:
    allowed: bool
    shadow_mode: bool
    dry_run: bool
    blocked_reason: str | None


@dataclass
class _FallbackStartupValidation:
    ok: bool
    errors: list[str]
    warnings: list[str]
    created_at: float


@dataclass
class _FallbackTraceContext:
    trace_id: str
    correlation_id: str
    tenant_id: str
    request_type: str
    source_layer: str


@dataclass
class _FallbackStructuredLog:
    trace_id: str
    correlation_id: str
    layer: str
    event_type: str
    severity: str
    payload_summary: dict[str, Any]
    safety_flags: list[str]


def _env_flag(name: str, default: bool = False, env: dict[str, str] | None = None) -> bool:
    source = env if env is not None else os.environ
    raw = source.get(name)
    if raw is None:
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


class _LocalInMemoryObservabilityEventBus:
    def __init__(
        self,
        max_events: int,
        ttl_enabled: bool,
        ttl_seconds: int,
    ) -> None:
        self._max_events = max(1, int(max_events))
        self._events: list[tuple[float, Any]] = []
        self._ttl_enabled = bool(ttl_enabled)
        self._ttl_seconds = max(1, int(ttl_seconds))
        self._dropped_events = 0

    def publish(self, event: Any) -> None:
        now = time.time()
        self._cleanup_expired(now)
        if len(self._events) >= self._max_events:
            self._events.pop(0)
            self._dropped_events += 1
        self._events.append((now, event))

    def list(self) -> list[Any]:
        self._cleanup_expired(time.time())
        return [event for _, event in self._events]

    def stats(self) -> dict[str, int]:
        self._cleanup_expired(time.time())
        return {
            "current_size": len(self._events),
            "max_size": self._max_events,
            "dropped_events": self._dropped_events,
        }

    def _cleanup_expired(self, now: float) -> None:
        if not self._ttl_enabled:
            return
        expiry_cutoff = now - self._ttl_seconds
        self._events = [entry for entry in self._events if entry[0] > expiry_cutoff]


def _resolve_event_bus_max_events(env: dict[str, str] | None = None) -> int:
    source = env if env is not None else os.environ
    raw_value = source.get("OBSERVABILITY_EVENT_BUS_MAX_EVENTS")
    if raw_value is None:
        return 1000
    try:
        value = int(str(raw_value).strip())
    except (TypeError, ValueError):
        return 1000
    return value if value > 0 else 1000


def _resolve_event_bus_ttl_enabled(env: dict[str, str] | None = None) -> bool:
    return _env_flag("OBSERVABILITY_EVENT_BUS_TTL_ENABLED", default=False, env=env)


def _resolve_event_bus_ttl_seconds(env: dict[str, str] | None = None) -> int:
    source = env if env is not None else os.environ
    raw_value = source.get("OBSERVABILITY_EVENT_BUS_TTL_SECONDS")
    if raw_value is None:
        return 900
    try:
        value = int(str(raw_value).strip())
    except (TypeError, ValueError):
        return 900
    return value if value > 0 else 900


def _create_local_event_bus() -> _LocalInMemoryObservabilityEventBus:
    return _LocalInMemoryObservabilityEventBus(
        max_events=_resolve_event_bus_max_events(),
        ttl_enabled=_resolve_event_bus_ttl_enabled(),
        ttl_seconds=_resolve_event_bus_ttl_seconds(),
    )


def _load_metabrain_runtime_dependencies() -> dict[str, Any] | None:
    try:
        from MetaBrain.observability_py.event_bus import (
            InMemoryObservabilityEventBus,
            resolve_event_bus_max_events,
            resolve_event_bus_ttl_enabled,
            resolve_event_bus_ttl_seconds,
        )
        from MetaBrain.observability_py.structured_logger import build_structured_log
        from MetaBrain.observability_py.telemetry_flags import load_observability_flags
        from MetaBrain.observability_py.trace_context import create_trace_context
        from MetaBrain.production_safety_py.runtime_guard import (
            evaluate_runtime_guard,
            load_production_safety_config,
        )
        from MetaBrain.production_safety_py.safe_fallback import build_safe_fallback
        from MetaBrain.production_safety_py.startup_validator import validate_production_safety_startup
    except Exception as exc:
        logger.warning("runtime_integration_metabrain_import_unavailable error=%s", exc)
        return None

    return {
        "InMemoryObservabilityEventBus": InMemoryObservabilityEventBus,
        "resolve_event_bus_max_events": resolve_event_bus_max_events,
        "resolve_event_bus_ttl_enabled": resolve_event_bus_ttl_enabled,
        "resolve_event_bus_ttl_seconds": resolve_event_bus_ttl_seconds,
        "build_structured_log": build_structured_log,
        "load_observability_flags": load_observability_flags,
        "create_trace_context": create_trace_context,
        "evaluate_runtime_guard": evaluate_runtime_guard,
        "load_production_safety_config": load_production_safety_config,
        "build_safe_fallback": build_safe_fallback,
        "validate_production_safety_startup": validate_production_safety_startup,
    }


def _build_fallback_snapshot(import_error: str) -> dict[str, Any]:
    observability_flags = _FallbackObservabilityFlags(
        enabled=_env_flag("OBSERVABILITY_ENABLED", default=True),
        external_export_enabled=False,
        phi_allowed=False,
    )
    guard = _FallbackRuntimeGuard(
        allowed=False,
        shadow_mode=True,
        dry_run=True,
        blocked_reason="metabrain_import_unavailable",
    )
    startup = _FallbackStartupValidation(
        ok=False,
        errors=[],
        warnings=[f"metabrain_import_unavailable: {import_error}"],
        created_at=time.time(),
    )
    fallback = {
        "action": "continue_existing_runtime_flow",
        "fallback_required": True,
        "reason": "metabrain_import_unavailable",
    }
    return {
        "guard": asdict(guard),
        "observability_flags": asdict(observability_flags),
        "startup_validation": asdict(startup),
        "fallback": fallback,
        "external_export_enabled": observability_flags.external_export_enabled,
        "phi_allowed": observability_flags.phi_allowed,
        "metabrain_import_available": False,
        "metabrain_import_error": import_error,
    }


def _create_fallback_trace_context(request: Request) -> _FallbackTraceContext:
    trace_id = request.headers.get(TRACE_HEADER) or f"trace-{uuid4().hex}"
    correlation_id = request.headers.get(CORRELATION_HEADER) or trace_id
    return _FallbackTraceContext(
        trace_id=trace_id,
        correlation_id=correlation_id,
        tenant_id=request.headers.get(TENANT_HEADER, "unknown"),
        request_type=f"{request.method} {request.url.path}",
        source_layer="api_runtime",
    )


def _build_fallback_structured_log(
    trace: _FallbackTraceContext,
    payload_summary: dict[str, Any],
    safety_flags: list[str],
    severity: str,
) -> _FallbackStructuredLog:
    return _FallbackStructuredLog(
        trace_id=trace.trace_id,
        correlation_id=trace.correlation_id,
        layer="system",
        event_type="runtime_passive_request",
        severity=severity,
        payload_summary=payload_summary,
        safety_flags=safety_flags,
    )


def _dataclass_to_dict(value: Any) -> Any:
    if is_dataclass(value):
        return asdict(value)
    return value


def _safe_headers(request: Request) -> dict[str, str]:
    headers: dict[str, str] = {}
    for key, value in request.headers.items():
        lower = key.lower()
        if any(marker in lower for marker in SENSITIVE_HEADER_MARKERS):
            headers[key] = "[REDACTED]"
        elif lower in {TRACE_HEADER, CORRELATION_HEADER, TENANT_HEADER, "user-agent"}:
            headers[key] = value[:128]
    return headers


def build_runtime_integration_snapshot(env: dict[str, str] | None = None) -> dict[str, Any]:
    """Build a non-blocking safety snapshot from current runtime flags."""
    source = env if env is not None else os.environ
    dependencies = _load_metabrain_runtime_dependencies()
    if dependencies is None:
        return _build_fallback_snapshot("MetaBrain runtime modules could not be imported")

    safety_config = dependencies["load_production_safety_config"](source)
    guard = dependencies["evaluate_runtime_guard"](safety_config)
    observability_flags = dependencies["load_observability_flags"](source)
    startup = dependencies["validate_production_safety_startup"](source)
    fallback = dependencies["build_safe_fallback"](guard.blocked_reason, asdict(guard))

    return {
        "guard": asdict(guard),
        "observability_flags": asdict(observability_flags),
        "startup_validation": {
            "ok": startup.ok,
            "errors": startup.errors,
            "warnings": startup.warnings,
            "created_at": startup.created_at,
        },
        "fallback": fallback,
        "external_export_enabled": observability_flags.external_export_enabled,
        "phi_allowed": observability_flags.phi_allowed,
        "metabrain_import_available": True,
        "metabrain_import_error": None,
    }


def initialize_runtime_integration_state(app: FastAPI) -> dict[str, Any]:
    """Initialize passive runtime integration state during startup."""
    snapshot = build_runtime_integration_snapshot()
    dependencies = _load_metabrain_runtime_dependencies()
    if dependencies is None:
        app.state.runtime_integration_event_bus = _create_local_event_bus()
    else:
        app.state.runtime_integration_event_bus = dependencies["InMemoryObservabilityEventBus"](
            max_events=dependencies["resolve_event_bus_max_events"](os.environ),
            ttl_enabled=dependencies["resolve_event_bus_ttl_enabled"](os.environ),
            ttl_seconds=dependencies["resolve_event_bus_ttl_seconds"](os.environ),
        )
    app.state.runtime_integration_snapshot = snapshot
    app.state.runtime_integration_metrics = {
        "requests_seen": 0,
        "events_published": 0,
        "shadow_executions": 0,
        "fallback_validations": 0,
        "last_latency_ms": None,
    }
    logger.info(
        "runtime_integration_startup guard_allowed=%s shadow=%s dry_run=%s fallback_required=%s metabrain_import_available=%s",
        snapshot["guard"]["allowed"],
        snapshot["guard"]["shadow_mode"],
        snapshot["guard"]["dry_run"],
        snapshot["fallback"]["fallback_required"],
        snapshot["metabrain_import_available"],
    )
    return snapshot


def get_runtime_integration_events(app: FastAPI) -> list[dict[str, Any]]:
    bus = getattr(app.state, "runtime_integration_event_bus", None)
    if bus is None:
        return []
    return [_dataclass_to_dict(event) for event in bus.list()]


def get_runtime_integration_event_bus_stats(app: FastAPI) -> dict[str, int]:
    bus = getattr(app.state, "runtime_integration_event_bus", None)
    if bus is None:
        return {"current_size": 0, "max_size": 0, "dropped_events": 0}
    stats = getattr(bus, "stats", None)
    if stats is None:
        events = bus.list()
        return {"current_size": len(events), "max_size": len(events), "dropped_events": 0}
    return stats()


async def passive_runtime_integration_middleware(request: Request, call_next):
    """Propagate trace context and emit sanitized telemetry without enforcement."""
    started = time.perf_counter()
    response = None
    error_name: str | None = None
    dependencies = _load_metabrain_runtime_dependencies()

    snapshot = getattr(request.app.state, "runtime_integration_snapshot", None)
    if snapshot is None:
        snapshot = build_runtime_integration_snapshot()
        request.app.state.runtime_integration_snapshot = snapshot

    observability = snapshot["observability_flags"]
    metrics = getattr(request.app.state, "runtime_integration_metrics", None)
    if metrics is not None:
        metrics["requests_seen"] = int(metrics.get("requests_seen") or 0) + 1

    if dependencies is None:
        trace = _create_fallback_trace_context(request)
    else:
        trace = dependencies["create_trace_context"](
            tenant_id=request.headers.get(TENANT_HEADER, "unknown"),
            request_type=f"{request.method} {request.url.path}",
            source_layer="api_runtime",
            trace_id=request.headers.get(TRACE_HEADER),
            correlation_id=request.headers.get(CORRELATION_HEADER),
        )
    request.state.trace_id = trace.trace_id
    request.state.correlation_id = trace.correlation_id

    try:
        response = await call_next(request)
        return response
    except Exception as exc:
        error_name = type(exc).__name__
        raise
    finally:
        elapsed_ms = round((time.perf_counter() - started) * 1000, 3)
        status_code = getattr(response, "status_code", 500 if error_name else None)
        if metrics is not None:
            metrics["last_latency_ms"] = elapsed_ms

        if observability["enabled"]:
            payload_summary = {
                "method": request.method,
                "path": request.url.path,
                "status_code": status_code,
                "latency_ms": elapsed_ms,
                "headers": _safe_headers(request),
                "shadow_mode": snapshot["guard"]["shadow_mode"],
                "dry_run": snapshot["guard"]["dry_run"],
                "fallback_required": snapshot["fallback"]["fallback_required"],
                "error": error_name,
            }
            safety_flags = [
                "external_export_disabled"
                if not observability["external_export_enabled"]
                else "external_export_enabled",
                "phi_blocked" if not observability["phi_allowed"] else "phi_allowed",
            ]
            if dependencies is None:
                event = _build_fallback_structured_log(
                    trace=trace,
                    payload_summary=payload_summary,
                    safety_flags=safety_flags,
                    severity="error" if error_name else "info",
                )
            else:
                event = dependencies["build_structured_log"](
                    trace=trace,
                    layer="system",
                    event_type="runtime_passive_request",
                    severity="error" if error_name else "info",
                    payload_summary=payload_summary,
                    safety_flags=safety_flags,
                )
            bus = getattr(request.app.state, "runtime_integration_event_bus", None)
            if bus is None:
                if dependencies is None:
                    bus = _create_local_event_bus()
                else:
                    bus = dependencies["InMemoryObservabilityEventBus"](
                        max_events=dependencies["resolve_event_bus_max_events"](os.environ),
                        ttl_enabled=dependencies["resolve_event_bus_ttl_enabled"](os.environ),
                        ttl_seconds=dependencies["resolve_event_bus_ttl_seconds"](os.environ),
                    )
                request.app.state.runtime_integration_event_bus = bus
            bus.publish(event)
            if metrics is not None:
                metrics["events_published"] = int(metrics.get("events_published") or 0) + 1

        if snapshot["guard"]["shadow_mode"] and snapshot["guard"]["dry_run"]:
            if metrics is not None:
                metrics["shadow_executions"] = int(metrics.get("shadow_executions") or 0) + 1
                metrics["fallback_validations"] = int(metrics.get("fallback_validations") or 0) + 1
