"""Integración de sesión por cookie HttpOnly para dashboard."""

from __future__ import annotations

from dataclasses import dataclass

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.app.api.v1.endpoints import auth, dashboard
from api.app.core.config import settings
from api.app.core.security import AUTH_COOKIE_NAME
from api.app.dependencies.db import get_db
from api.app.services.user_service import UserService


@dataclass
class _FakeRole:
    value: str


@dataclass
class _FakeUser:
    username: str
    role: _FakeRole
    doctor_id: str | None = None


@dataclass
class _FakeResult:
    value: int

    def scalar(self) -> int:
        return self.value


class _FakeDBSession:
    def __init__(self) -> None:
        self._calls = 0

    async def execute(self, _query):
        self._calls += 1
        if self._calls == 1:
            return _FakeResult(4)  # appointments_today
        return _FakeResult(2)  # pending_actions


@pytest.fixture
def client() -> TestClient:
    test_app = FastAPI()
    test_app.include_router(auth.router, prefix="/api/v1")
    test_app.include_router(dashboard.router, prefix="/api/v1")

    async def _override_get_db():
        yield _FakeDBSession()

    test_app.dependency_overrides[get_db] = _override_get_db
    return TestClient(test_app)


@pytest.fixture
def fake_admin_auth(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _authenticate(_db, username: str, _password: str):
        return _FakeUser(username=username, role=_FakeRole("admin"))

    monkeypatch.setattr(UserService, "authenticate_user", staticmethod(_authenticate))


@pytest.fixture
def non_secure_cookie(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "debug", True)


def test_cookie_session_login_dashboard_logout_flow(
    client: TestClient,
    fake_admin_auth: None,
    non_secure_cookie: None,
) -> None:
    login_response = client.post(
        "/api/v1/auth/token",
        data={"username": "admin_test", "password": "irrelevant"},
    )

    assert login_response.status_code == 200
    set_cookie_header = login_response.headers.get("set-cookie", "")
    assert AUTH_COOKIE_NAME in set_cookie_header
    assert "HttpOnly" in set_cookie_header
    assert AUTH_COOKIE_NAME in client.cookies

    session_response = client.get("/api/v1/auth/session")
    assert session_response.status_code == 200
    session_payload = session_response.json()
    assert session_payload["authenticated"] is True
    assert session_payload["username"] == "admin_test"
    assert session_payload["role"] == "admin"

    dashboard_response = client.get("/api/v1/dashboard/stats")
    assert dashboard_response.status_code == 200
    dashboard_payload = dashboard_response.json()
    assert "appointments_today" in dashboard_payload
    assert "pending_actions" in dashboard_payload
    assert "bot_health" in dashboard_payload

    logout_response = client.post("/api/v1/auth/logout")
    assert logout_response.status_code == 200

    after_logout_session = client.get("/api/v1/auth/session")
    assert after_logout_session.status_code == 401
