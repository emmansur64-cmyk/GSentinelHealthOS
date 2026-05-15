import pytest

fastapi = pytest.importorskip("fastapi")
testclient = pytest.importorskip("fastapi.testclient")

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.app.runtime_integration import (
    get_runtime_integration_events,
    initialize_runtime_integration_state,
    passive_runtime_integration_middleware,
)


def _build_app() -> FastAPI:
    app = FastAPI()
    app.middleware("http")(passive_runtime_integration_middleware)

    @app.get("/probe")
    async def probe():
        return {"ok": True}

    return app


def test_runtime_guard_defaults_to_safe_fallback(monkeypatch):
    monkeypatch.delenv("AI_RUNTIME_ENABLED", raising=False)
    monkeypatch.delenv("AI_RUNTIME_KILL_SWITCH", raising=False)
    monkeypatch.delenv("OBSERVABILITY_ENABLED", raising=False)
    app = _build_app()

    snapshot = initialize_runtime_integration_state(app)

    assert snapshot["guard"]["allowed"] is False
    assert snapshot["guard"]["dry_run"] is True
    assert snapshot["guard"]["shadow_mode"] is True
    assert snapshot["fallback"]["action"] == "continue_existing_runtime_flow"
    assert snapshot["external_export_enabled"] is False
    assert snapshot["phi_allowed"] is False


def test_passive_observability_sanitizes_headers_and_preserves_response(monkeypatch):
    monkeypatch.setenv("OBSERVABILITY_ENABLED", "true")
    monkeypatch.setenv("OBSERVABILITY_SHADOW_MODE", "true")
    monkeypatch.setenv("OBSERVABILITY_EXTERNAL_EXPORT_ENABLED", "false")
    monkeypatch.setenv("OBSERVABILITY_PHI_ALLOWED", "false")
    monkeypatch.setenv("AI_RUNTIME_ENABLED", "false")
    monkeypatch.setenv("AI_RUNTIME_SHADOW_MODE", "true")
    monkeypatch.setenv("AI_RUNTIME_DRY_RUN", "true")
    monkeypatch.setenv("AI_RUNTIME_KILL_SWITCH", "true")

    app = _build_app()
    initialize_runtime_integration_state(app)

    with TestClient(app) as client:
        response = client.get(
            "/probe",
            headers={
                "Authorization": "Bearer secret-token",
                "X-Trace-Id": "trace-test",
                "X-Correlation-Id": "corr-test",
            },
        )

    assert response.status_code == 200
    assert response.json() == {"ok": True}

    events = get_runtime_integration_events(app)
    assert len(events) == 1
    assert events[0]["trace_id"] == "trace-test"
    assert events[0]["correlation_id"] == "corr-test"
    assert events[0]["payload_summary"]["headers"] == "[SUMMARY_ONLY]"
    assert "external_export_disabled" in events[0]["safety_flags"]
    assert "phi_blocked" in events[0]["safety_flags"]

    metrics = app.state.runtime_integration_metrics
    assert metrics["requests_seen"] == 1
    assert metrics["shadow_executions"] == 1
    assert metrics["fallback_validations"] == 1
