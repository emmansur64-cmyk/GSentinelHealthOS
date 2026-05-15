"""HTTP hardening tests for passive runtime integration.

These tests are intentionally local-only and skip when the FastAPI test
environment is not installed.
"""

from __future__ import annotations

import importlib

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("fastapi.testclient")

from fastapi.testclient import TestClient


SAFE_RUNTIME_FLAGS = {
    "AI_RUNTIME_ENABLED": "false",
    "AI_RUNTIME_SHADOW_MODE": "true",
    "AI_RUNTIME_DRY_RUN": "true",
    "AI_RUNTIME_KILL_SWITCH": "true",
    "AI_RUNTIME_SAFE_FALLBACK": "true",
    "AI_RUNTIME_BLOCKING_ENABLED": "false",
    "AI_RUNTIME_EXTERNAL_CALLS_ALLOWED": "false",
    "AI_RUNTIME_PHI_ALLOWED": "false",
    "OBSERVABILITY_ENABLED": "true",
    "OBSERVABILITY_SHADOW_MODE": "true",
    "OBSERVABILITY_EXTERNAL_EXPORT_ENABLED": "false",
    "OBSERVABILITY_PHI_ALLOWED": "false",
    "DEBUG": "false",
    "DATABASE_URL": "sqlite+aiosqlite:///./runtime_lab.sqlite",
    "REDIS_URL": "redis://127.0.0.1:6379",
}


@pytest.fixture()
def runtime_app(monkeypatch):
    for key, value in SAFE_RUNTIME_FLAGS.items():
        monkeypatch.setenv(key, value)
    module = importlib.import_module("api.app.main")
    module.initialize_runtime_integration_state(module.app)
    return module.app


def test_root_body_is_preserved_and_trace_context_is_recorded(runtime_app):
    client = TestClient(runtime_app)
    response = client.get(
        "/",
        headers={
            "X-Trace-Id": "trace-http-e2e",
            "X-Correlation-Id": "corr-http-e2e",
            "Authorization": "Bearer secret-token",
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "message": "GSentinelHealthOS API",
        "services": ["patients", "doctors"],
        "health": "/api/health/readiness",
    }

    events = runtime_app.state.runtime_integration_event_bus.list()
    assert events
    event = events[-1]
    assert event.trace_id == "trace-http-e2e"
    assert event.correlation_id == "corr-http-e2e"
    assert "phi_blocked" in event.safety_flags
    assert "external_export_disabled" in event.safety_flags
    assert "secret-token" not in str(event.payload_summary)


def test_kill_switch_and_safe_fallback_do_not_block_liveness(runtime_app):
    client = TestClient(runtime_app)
    response = client.get("/api/health/liveness")

    assert response.status_code == 200
    assert response.json()["status"] == "alive"

    snapshot = runtime_app.state.runtime_integration_snapshot
    assert snapshot["guard"]["allowed"] is False
    assert snapshot["guard"]["dry_run"] is True
    assert snapshot["guard"]["shadow_mode"] is True
    assert snapshot["fallback"]["action"] == "continue_existing_runtime_flow"


def test_shadow_counters_do_not_alter_output(runtime_app):
    client = TestClient(runtime_app)
    before = dict(runtime_app.state.runtime_integration_metrics)
    response = client.get("/")
    after = dict(runtime_app.state.runtime_integration_metrics)

    assert response.status_code == 200
    assert response.json()["message"] == "GSentinelHealthOS API"
    assert after["requests_seen"] == before["requests_seen"] + 1
    assert after["shadow_executions"] == before["shadow_executions"] + 1
    assert after["fallback_validations"] == before["fallback_validations"] + 1
