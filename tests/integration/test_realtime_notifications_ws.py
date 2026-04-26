from __future__ import annotations

import asyncio

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.app.api.v1.endpoints import realtime
from api.app.eventing.realtime_notifications import (
    broadcast_realtime_event,
    realtime_notification_manager,
)


def test_notifications_websocket_broadcasts_json_events() -> None:
    app = FastAPI()
    app.include_router(realtime.router)

    with TestClient(app) as client:
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

    with TestClient(app) as client:
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