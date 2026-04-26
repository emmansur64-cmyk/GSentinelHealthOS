"""Tests de integración para sincronización Google Calendar vía Outbox."""

from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest


def _imports_or_skip():
    try:
        from api.app.models import NotificationOutbox
        from api.app.services import outbox_service as outbox_module
        from api.app.services.outbox_service import OutboxService
        return NotificationOutbox, outbox_module, OutboxService
    except Exception as exc:  # pragma: no cover
        pytest.skip(f"Runtime incompatible for SQLAlchemy integration: {exc}")


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "event_type,method_name",
    [
        ("appointment.google.create", "create_event_for_appointment"),
        ("appointment.google.update", "update_event_for_appointment"),
        ("appointment.google.delete", "delete_event_for_appointment"),
    ],
)
async def test_google_outbox_dispatch_success(monkeypatch: pytest.MonkeyPatch, event_type: str, method_name: str) -> None:
    """Outbox debe marcar sent para create/update/delete de Google Calendar."""

    NotificationOutbox, outbox_module, OutboxService = _imports_or_skip()

    db = SimpleNamespace(commit=AsyncMock())
    service = OutboxService(cast(Any, db))

    appointment_id = uuid4()
    item = NotificationOutbox(
        id=uuid4(),
        event_type=event_type,
        aggregate_type="appointment",
        aggregate_id=appointment_id,
        payload={"appointment_id": str(appointment_id)},
        status="pending",
        attempts=0,
        next_attempt_at=datetime.utcnow(),
    )

    class FakeCalendarService:
        def __init__(self, _db):
            self.db = _db

        async def create_event_for_appointment(self, _appointment_id):
            return SimpleNamespace(success=True, message="", event_id="evt-1")

        async def update_event_for_appointment(self, _appointment_id):
            return SimpleNamespace(success=True, message="", event_id="evt-1")

        async def delete_event_for_appointment(self, _appointment_id):
            return SimpleNamespace(success=True, message="", event_id="evt-1")

    monkeypatch.setattr(outbox_module, "GoogleCalendarService", FakeCalendarService)

    await service.dispatch_one(item)

    assert cast(str, item.status) == "sent"
    assert cast(Any, item.sent_at) is not None
    assert cast(Any, item.last_error) is None
    assert cast(int, item.attempts) == 0


@pytest.mark.asyncio
async def test_google_outbox_dispatch_failure_retries(monkeypatch: pytest.MonkeyPatch) -> None:
    """Si Google falla, outbox debe pasar a failed e incrementar attempts con reintento."""

    NotificationOutbox, outbox_module, OutboxService = _imports_or_skip()

    db = SimpleNamespace(commit=AsyncMock())
    service = OutboxService(cast(Any, db))

    appointment_id = uuid4()
    item = NotificationOutbox(
        id=uuid4(),
        event_type="appointment.google.create",
        aggregate_type="appointment",
        aggregate_id=appointment_id,
        payload={"appointment_id": str(appointment_id)},
        status="pending",
        attempts=0,
        next_attempt_at=datetime.utcnow(),
    )

    class FakeCalendarService:
        def __init__(self, _db):
            self.db = _db

        async def create_event_for_appointment(self, _appointment_id):
            return SimpleNamespace(success=False, message="network_timeout", event_id=None)

    monkeypatch.setattr(outbox_module, "GoogleCalendarService", FakeCalendarService)

    await service.dispatch_one(item)

    assert cast(str, item.status) == "failed"
    assert cast(int, item.attempts) == 1
    assert cast(Any, item.last_error) is not None
    assert cast(Any, item.next_attempt_at) is not None
