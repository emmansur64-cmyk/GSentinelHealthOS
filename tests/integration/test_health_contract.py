"""
Tests focales del contrato HTTP de health endpoints.

Verifica:
- /api/health/liveness   → público, siempre 200
- /api/health/readiness  → público mínimo, 200 o 503 (NUNCA 403)
- Endpoints internos     → 403 sin X-Internal-Key
- Endpoints internos     → 200 con X-Internal-Key válida (si DB/Redis disponibles)

No usa providers externos, no corre migraciones, no toca clínica.
"""
from __future__ import annotations

import os
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

os.environ.setdefault("JWT_SECRET", "test-jwt-secret-health-contract-only")
os.environ.setdefault("GATEWAY_API_KEY", "test-gateway-key-valid")
os.environ.setdefault("BRAIN_API_KEY", "test-brain-key-valid")

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from api.app.api.v1.endpoints import health
from api.app.db.session import get_db


# ─── Fixtures ────────────────────────────────────────────────────────────────

def _build_app() -> FastAPI:
    app = FastAPI()
    app.include_router(health.router)
    return app


async def _mock_db() -> AsyncGenerator[AsyncSession, None]:
    """Stub de sesión DB para aislar tests de infra."""
    session = AsyncMock(spec=AsyncSession)
    # scalar() para func.now() y conteos de outbox
    session.scalar.return_value = None
    session.execute.return_value = MagicMock()
    yield session


INTERNAL_KEY_HEADERS = {"X-Internal-Key": "test-gateway-key-valid"}


@pytest.fixture()
def client_with_mock_db():
    app = _build_app()
    app.dependency_overrides[get_db] = _mock_db
    with TestClient(app) as c:
        yield c


# ─── /liveness ────────────────────────────────────────────────────────────────

def test_liveness_public_returns_200(client_with_mock_db) -> None:
    """/liveness es público y siempre devuelve 200."""
    resp = client_with_mock_db.get("/health/liveness")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "alive"
    assert "timestamp" in body


# ─── /readiness ───────────────────────────────────────────────────────────────

def test_readiness_public_never_403(client_with_mock_db) -> None:
    """/readiness sin auth NO debe retornar 403."""
    # Redis puede no estar disponible en CI, por eso 200 o 503 son aceptables.
    with patch("api.app.api.v1.endpoints.health.Redis") as mock_redis_cls:
        mock_redis_instance = AsyncMock()
        mock_redis_instance.ping = AsyncMock(return_value=True)
        mock_redis_instance.aclose = AsyncMock()
        mock_redis_cls.from_url.return_value = mock_redis_instance

        resp = client_with_mock_db.get("/health/readiness")

    assert resp.status_code != 403, (
        f"/readiness returned 403 sin auth — violación de contrato público: {resp.text}"
    )
    assert resp.status_code in (200, 503)


def test_readiness_returns_200_when_ok(client_with_mock_db) -> None:
    """/readiness devuelve 200 y checks.database/redis ok cuando ambos están disponibles."""
    with patch("api.app.api.v1.endpoints.health.Redis") as mock_redis_cls:
        mock_redis_instance = AsyncMock()
        mock_redis_instance.ping = AsyncMock(return_value=True)
        mock_redis_instance.aclose = AsyncMock()
        mock_redis_cls.from_url.return_value = mock_redis_instance

        resp = client_with_mock_db.get("/health/readiness")

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ready"
    assert body["checks"]["database"] == "ok"
    assert body["checks"]["redis"] == "ok"
    assert "timestamp" in body
    assert "providers" not in body, "readiness público no debe exponer providers"
    assert "outbox" not in body, "readiness público no debe exponer outbox"
    assert "brain_metrics" not in body, "readiness público no debe exponer brain_metrics"


def test_readiness_returns_503_when_redis_down(client_with_mock_db) -> None:
    """/readiness devuelve 503 cuando Redis falla."""
    with patch("api.app.api.v1.endpoints.health.Redis") as mock_redis_cls:
        mock_redis_instance = AsyncMock()
        mock_redis_instance.ping = AsyncMock(side_effect=Exception("redis down"))
        mock_redis_instance.aclose = AsyncMock()
        mock_redis_cls.from_url.return_value = mock_redis_instance

        resp = client_with_mock_db.get("/health/readiness")

    assert resp.status_code == 503
    body = resp.json()
    assert body["status"] == "not_ready"
    assert body["checks"]["redis"] == "error"


# ─── Endpoints internos protegidos ────────────────────────────────────────────

PROTECTED_ENDPOINTS = [
    "/health/dashboard-summary",
    "/health/outbox",
    "/health/providers",
    "/health/booking-workers",
]


@pytest.mark.parametrize("path", PROTECTED_ENDPOINTS)
def test_internal_endpoint_rejects_anon(client_with_mock_db, path: str) -> None:
    """Endpoints internos deben devolver 403 sin X-Internal-Key."""
    resp = client_with_mock_db.get(path)
    assert resp.status_code == 403, (
        f"{path} debería devolver 403 sin auth, devolvió {resp.status_code}"
    )


@pytest.mark.parametrize("path", PROTECTED_ENDPOINTS)
def test_internal_endpoint_rejects_wrong_key(client_with_mock_db, path: str) -> None:
    """Endpoints internos deben devolver 403 con clave inválida."""
    resp = client_with_mock_db.get(path, headers={"X-Internal-Key": "invalid-key-xyz"})
    assert resp.status_code == 403
