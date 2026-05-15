from __future__ import annotations

from fastapi.testclient import TestClient

from cerebro_ai_med.main import app


class _HealthyLimiter:
    async def ping(self) -> bool:
        return True


def test_health_includes_observability_headers() -> None:
    client = TestClient(app)
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert "X-Request-ID" in response.headers
    assert "X-Process-Time-ms" in response.headers


def test_health_live_reports_service_up() -> None:
    client = TestClient(app)
    response = client.get("/health/live")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "cerebro_ai_med"
    assert isinstance(body["version"], str) and len(body["version"]) > 0


def test_health_ready_degraded_without_api_key(monkeypatch) -> None:
    monkeypatch.delenv("CEREBRO_API_KEY", raising=False)

    client = TestClient(app)
    app.state.rate_limiter = _HealthyLimiter()
    response = client.get("/health/ready")

    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "degraded"
    assert body["checks"]["api_key_configured"] is False
    assert body["checks"]["redis_connected"] is True
    assert "model_health" in body
    assert "checks" in body["model_health"]


def test_health_ready_ok_with_api_key(monkeypatch) -> None:
    monkeypatch.setenv("CEREBRO_API_KEY", "step-c-ready-key")

    client = TestClient(app)
    app.state.rate_limiter = _HealthyLimiter()
    response = client.get("/health/ready")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ready"

    checks = body["checks"]
    assert checks["api_key_configured"] is True
    assert checks["model_registry_exists"] is True
    assert checks["active_model_valid"] is True
    assert checks["model_service_loaded"] is True
    assert checks["integrity_ok"] is True
    assert checks["redis_connected"] is True
    assert isinstance(checks["model_version"], str) and len(checks["model_version"]) > 0

    model_health = body["model_health"]
    assert model_health["status"] == "healthy"
    assert isinstance(model_health["active_model_version"], str)
    assert model_health["checks"]["registry_exists"] is True
    assert model_health["checks"]["registry_parse_ok"] is True
    assert model_health["checks"]["active_model_resolved"] is True
    assert model_health["checks"]["artifact_integrity_ok"] is True


def test_health_model_endpoint_exposes_deep_checks(monkeypatch) -> None:
    monkeypatch.setenv("CEREBRO_API_KEY", "step-c-ready-key")

    client = TestClient(app)
    response = client.get("/health/model")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert isinstance(body["active_model_version"], str) and len(body["active_model_version"]) > 0

    checks = body["checks"]
    assert checks["registry_exists"] is True
    assert checks["registry_parse_ok"] is True
    assert checks["active_model_resolved"] is True
    assert checks["text_artifact_exists"] is True
    assert checks["image_artifact_exists"] is True
    assert checks["text_checksum_match"] is True
    assert checks["image_checksum_match"] is True
    assert checks["artifact_integrity_ok"] is True
    assert checks["model_service_loaded"] is True
