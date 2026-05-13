from __future__ import annotations

import asyncio
import os

import pytest

os.environ.setdefault("JWT_SECRET", "test-jwt-secret-for-ws-compat-tests-only")
os.environ.setdefault("GATEWAY_API_KEY", "test-gateway-key-valid")
os.environ.setdefault("BRAIN_API_KEY", "test-brain-key-valid")

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.app.api.v1.endpoints import realtime
from api.app.core.security import create_access_token, AUTH_COOKIE_NAME
from api.app.eventing.realtime_notifications import (
    broadcast_realtime_event,
    realtime_notification_manager,
)


def _make_jwt() -> str:
    """Crea un JWT válido firmado con el secreto de test."""
    return create_access_token({"sub": "test-user-ws", "scopes": []})


# ─── Tests de autenticación ───────────────────────────────────────────────────

def test_notifications_websocket_rejects_without_cookie() -> None:
    """WS sin cookie debe cerrarse con código 1008 (WebSocketDisconnect al conectar)."""
    from starlette.websockets import WebSocketDisconnect

    app = FastAPI()
    app.include_router(realtime.router)

    with TestClient(app) as client:
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect("/ws/notifications"):
                pass
    asyncio.run(realtime_notification_manager.reset())


def test_notifications_websocket_rejects_invalid_jwt() -> None:
    """WS con JWT inválido debe cerrarse con código 1008 (WebSocketDisconnect al conectar)."""
    from starlette.websockets import WebSocketDisconnect

    app = FastAPI()
    app.include_router(realtime.router)

    with TestClient(app) as client:
        client.cookies.set(AUTH_COOKIE_NAME, "not.a.valid.token")
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect("/ws/notifications"):
                pass
    asyncio.run(realtime_notification_manager.reset())


def test_notifications_websocket_accepts_gs_access_token() -> None:
    """WS con cookie gs_access_token válida debe conectar y recibir eventos."""
    app = FastAPI()
    app.include_router(realtime.router)

    token = _make_jwt()

    with TestClient(app) as client:
        client.cookies.set(AUTH_COOKIE_NAME, token)
        with client.websocket_connect("/ws/notifications") as websocket:
            asyncio.run(
                broadcast_realtime_event(
                    "appointment_created",
                    {"appointment_id": "appt-ws-1", "status": "scheduled"},
                )
            )
            payload = websocket.receive_json()

    assert payload["type"] == "appointment_created"
    assert payload["payload"]["appointment_id"] == "appt-ws-1"
    assert "sent_at" in payload
    asyncio.run(realtime_notification_manager.reset())


def test_notifications_websocket_accepts_auth_token_cookie() -> None:
    """WS con cookie auth_token (legacy frontend) debe conectar y recibir eventos."""
    app = FastAPI()
    app.include_router(realtime.router)

    token = _make_jwt()

    with TestClient(app) as client:
        client.cookies.set("auth_token", token)
        with client.websocket_connect("/ws/notifications") as websocket:
            asyncio.run(
                broadcast_realtime_event(
                    "appointment_rescheduled",
                    {"appointment_id": "appt-ws-2", "status": "rescheduled"},
                )
            )
            payload = websocket.receive_json()

    assert payload["type"] == "appointment_rescheduled"
    assert payload["payload"]["appointment_id"] == "appt-ws-2"
    asyncio.run(realtime_notification_manager.reset())


# ─── Tests de broadcast heredados (ahora con auth) ───────────────────────────

def test_notifications_websocket_broadcasts_json_events() -> None:
    app = FastAPI()
    app.include_router(realtime.router)

    token = _make_jwt()

    with TestClient(app) as client:
        client.cookies.set(AUTH_COOKIE_NAME, token)
        with client.websocket_connect("/ws/notifications") as websocket:
            asyncio.run(
                broadcast_realtime_event(
                    "appointment_created",
                    {"appointment_id": "appt-123", "status": "scheduled"},
                )
            )

            payload = websocket.receive_json()

    assert payload["type"] == "appointment_created"
    assert payload["payload"]["appointment_id"] == "appt-123"
    assert payload["payload"]["status"] == "scheduled"
    assert "sent_at" in payload
    asyncio.run(realtime_notification_manager.reset())


def test_notifications_websocket_supports_whatsapp_events() -> None:
    app = FastAPI()
    app.include_router(realtime.router)

    token = _make_jwt()

    with TestClient(app) as client:
        client.cookies.set(AUTH_COOKIE_NAME, token)
        with client.websocket_connect("/ws/notifications") as websocket:
            asyncio.run(
                broadcast_realtime_event(
                    "whatsapp_message_received",
                    {"phone": "+5491112345678", "intent": "book_appointment"},
                )
            )

            payload = websocket.receive_json()

    assert payload["type"] == "whatsapp_message_received"
    assert payload["payload"]["phone"] == "+5491112345678"
    assert payload["payload"]["intent"] == "book_appointment"
    asyncio.run(realtime_notification_manager.reset())
