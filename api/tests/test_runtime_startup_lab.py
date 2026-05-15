"""Startup/lifespan validation in isolated runtime lab mode.

This suite loads .env.runtime_lab explicitly to avoid inheriting non-lab settings.
"""

from __future__ import annotations

import importlib
import os
import sys
from pathlib import Path

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("fastapi.testclient")

from fastapi.testclient import TestClient


def _load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        values[key.strip()] = value.strip()
    return values


@pytest.fixture()
def runtime_lab_app(monkeypatch):
    env_path = Path(__file__).resolve().parents[2] / ".env.runtime_lab"
    env_values = _load_env_file(env_path)
    for key, value in env_values.items():
        monkeypatch.setenv(key, value)

    # Fuerza reload para evitar cache de settings previos del proceso de tests.
    for module_name in [
        "api.app.core.config",
        "api.app.db.session",
        "api.app.main",
    ]:
        if module_name in sys.modules:
            del sys.modules[module_name]

    module = importlib.import_module("api.app.main")
    return module.app


def test_startup_shutdown_root_and_liveness_preserve_contract(runtime_lab_app):
    trace_id = "trace-startup-lab"
    corr_id = "corr-startup-lab"

    with TestClient(runtime_lab_app) as client:
        root_response = client.get(
            "/",
            headers={
                "X-Trace-Id": trace_id,
                "X-Correlation-Id": corr_id,
            },
        )
        liveness_response = client.get("/api/health/liveness")

        assert root_response.status_code == 200
        assert root_response.json() == {
            "message": "GSentinelHealthOS API",
            "services": ["patients", "doctors"],
            "health": "/api/health/readiness",
        }

        assert liveness_response.status_code == 200
        liveness_body = liveness_response.json()
        assert liveness_body["status"] == "alive"

        # Verifica propagación de trace/correlation vía observability event bus.
        events = runtime_lab_app.state.runtime_integration_event_bus.list()
        assert events, "Se esperaba al menos un evento de observability"
        last_root_event = next(
            event
            for event in reversed(events)
            if event.payload_summary.get("path") == "/"
        )
        assert last_root_event.trace_id == trace_id
        assert last_root_event.correlation_id == corr_id

        # Invariantes de seguridad del runtime pasivo.
        snapshot = runtime_lab_app.state.runtime_integration_snapshot
        assert snapshot["guard"]["allowed"] is False
        assert snapshot["guard"]["dry_run"] is True
        assert snapshot["guard"]["shadow_mode"] is True
        assert snapshot["external_export_enabled"] is False
        assert snapshot["phi_allowed"] is False


def test_startup_does_not_require_provider_calls_for_root_or_liveness(runtime_lab_app, monkeypatch):
    called = {"providers": 0}

    health_module = importlib.import_module("api.app.api.v1.endpoints.health")
    original = health_module._collect_provider_observability

    async def _wrapped_provider_call():
        called["providers"] += 1
        return await original()

    monkeypatch.setattr(health_module, "_collect_provider_observability", _wrapped_provider_call)

    with TestClient(runtime_lab_app) as client:
        root_response = client.get("/")
        liveness_response = client.get("/api/health/liveness")

    assert root_response.status_code == 200
    assert liveness_response.status_code == 200
    assert called["providers"] == 0
