"""Tests de confiabilidad del patron Outbox para notificaciones n8n."""

from __future__ import annotations

from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest


def _imports_or_skip():
    try:
        from api.app.models import NotificationOutbox
        from api.app.services import outbox_service as outbox_module
        from api.app.services.outbox_service import OutboxService
        return NotificationOutbox, outbox_module, OutboxService
    except Exception as exc:  # pragma: no cover - runtime/environment gate
        pytest.skip(f"Runtime incompatible for SQLAlchemy integration: {exc}")


@pytest.mark.asyncio
async def test_outbox_transitions_failed_to_sent(monkeypatch: pytest.MonkeyPatch) -> None:
    """Si n8n falla primero y luego se recupera, el outbox debe pasar failed -> sent."""

    NotificationOutbox, outbox_module, OutboxService = _imports_or_skip()

    db = SimpleNamespace(commit=AsyncMock())
    service = OutboxService(db)

    item = NotificationOutbox(
        id=uuid4(),
        event_type="appointment.confirmed",
        aggregate_type="appointment",
        aggregate_id=uuid4(),
        payload={"appointment_id": str(uuid4())},
        status="pending",
        attempts=0,
        next_attempt_at=datetime.utcnow(),
    )

    async def fail_once(_: dict) -> None:
        raise RuntimeError("n8n temporary outage")

    monkeypatch.setattr(outbox_module, "notify_appointment_confirmation", fail_once)
    await service.dispatch_one(item)

    assert item.status == "failed"
    assert item.attempts == 1
    assert item.last_error is not None
    assert item.sent_at is None

    # Simula ventana de retry cumplida.
    item.next_attempt_at = datetime.utcnow() - timedelta(seconds=1)

    async def success(_: dict) -> None:
        return None

    monkeypatch.setattr(outbox_module, "notify_appointment_confirmation", success)
    await service.dispatch_one(item)

    assert item.status == "sent"
    assert item.sent_at is not None


@pytest.mark.asyncio
async def test_dispatch_batch_processes_pending_items(monkeypatch: pytest.MonkeyPatch) -> None:
    """dispatch_batch debe procesar pendientes y confirmar commit de unidad de trabajo."""

    NotificationOutbox, outbox_module, OutboxService = _imports_or_skip()

    db = SimpleNamespace(commit=AsyncMock())
    service = OutboxService(db)

    item = NotificationOutbox(
        id=uuid4(),
        event_type="appointment.confirmed",
        aggregate_type="appointment",
        aggregate_id=uuid4(),
        payload={"appointment_id": str(uuid4())},
        status="pending",
        attempts=0,
        next_attempt_at=datetime.utcnow(),
    )

    async def success(_: dict) -> None:
        return None

    monkeypatch.setattr(outbox_module, "notify_appointment_confirmation", success)

    async def fake_fetch_pending(limit: int = 100):
        assert limit == 10
        return [item]

    monkeypatch.setattr(service, "fetch_pending", fake_fetch_pending)

    summary = await service.dispatch_batch(limit=10)

    assert summary == {"processed": 1, "sent": 1, "failed": 0}
    db.commit.assert_awaited_once()
