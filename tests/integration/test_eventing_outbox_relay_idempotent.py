from __future__ import annotations

import json
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from api.app.eventing.booking_workflows import BookingWorkflowService
from api.app.eventing.notifications import NotificationDispatcher
from api.app.eventing import relay as relay_module
from api.app.eventing.relay import OutboxRelay


class _FakeMessage:
    def __init__(self, **kwargs):
        self.body = kwargs["body"]
        self.content_type = kwargs.get("content_type")
        self.delivery_mode = kwargs.get("delivery_mode")
        self.message_id = kwargs.get("message_id")
        self.type = kwargs.get("type")


class _FakeExchange:
    def __init__(self, published: list[dict]):
        self._published = published

    async def publish(self, message: _FakeMessage, routing_key: str) -> None:
        self._published.append(
            {
                "routing_key": routing_key,
                "message_id": message.message_id,
                "type": message.type,
                "body": message.body,
            }
        )


class _FakeChannel:
    def __init__(self, published: list[dict]):
        self._published = published

    async def declare_exchange(self, _name: str, _exchange_type: str, durable: bool):
        _ = durable
        return _FakeExchange(self._published)

    async def close(self) -> None:
        return None


class _FakeConnection:
    def __init__(self, published: list[dict]):
        self._published = published

    async def channel(self, publisher_confirms: bool = True):
        _ = publisher_confirms
        return _FakeChannel(self._published)

    async def close(self) -> None:
        return None


class _FakeAioPika:
    class ExchangeType:
        TOPIC = "topic"

    class DeliveryMode:
        PERSISTENT = 2

    Message = _FakeMessage

    def __init__(self, published: list[dict]):
        self._published = published

    async def connect_robust(self, _url: str):
        return _FakeConnection(self._published)


@pytest_asyncio.fixture
async def eventing_db_factory(tmp_path):
    db_file = tmp_path / "eventing_flow.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}", echo=False, future=True)

    async with engine.begin() as conn:
        await conn.execute(text("CREATE TABLE doctors (id INTEGER PRIMARY KEY)"))
        await conn.execute(text("CREATE TABLE patients (id INTEGER PRIMARY KEY)"))
        await conn.execute(
            text(
                """
                CREATE TABLE time_slots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    doctor_id INTEGER NOT NULL,
                    start_time DATETIME NOT NULL,
                    end_time DATETIME NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'available',
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        await conn.execute(
            text(
                """
                CREATE TABLE appointments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    slot_id INTEGER NOT NULL UNIQUE,
                    patient_id INTEGER NOT NULL,
                    status VARCHAR(20) NOT NULL,
                    priority VARCHAR(20) NOT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        await conn.execute(
            text(
                """
                CREATE TABLE outbox_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id VARCHAR(36) NOT NULL UNIQUE,
                    event_type VARCHAR(100) NOT NULL,
                    routing_key VARCHAR(150) NOT NULL,
                    aggregate_type VARCHAR(80) NOT NULL,
                    aggregate_id VARCHAR(120) NOT NULL,
                    payload JSON NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    attempts INTEGER NOT NULL DEFAULT 0,
                    max_retries INTEGER NOT NULL DEFAULT 8,
                    next_attempt_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    published_at DATETIME NULL,
                    last_error TEXT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        await conn.execute(
            text(
                """
                CREATE TABLE processed_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    consumer_name VARCHAR(120) NOT NULL,
                    event_id VARCHAR(36) NOT NULL,
                    processed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (consumer_name, event_id)
                )
                """
            )
        )

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        yield session_factory
    finally:
        await engine.dispose()


@pytest.mark.integration
@pytest.mark.asyncio
async def test_outbox_relay_and_idempotent_consumer_end_to_end(eventing_db_factory, monkeypatch):
    published: list[dict] = []
    fake_aio_pika = _FakeAioPika(published)
    monkeypatch.setattr(relay_module, "_load_aio_pika", lambda: fake_aio_pika)

    async with eventing_db_factory() as db:
        await db.execute(text("INSERT INTO doctors (id) VALUES (1)"))
        await db.execute(text("INSERT INTO patients (id) VALUES (100)"))
        start_time = datetime(2026, 4, 5, 9, 0, 0)
        end_time = start_time + timedelta(minutes=30)
        await db.execute(
            text(
                """
                INSERT INTO time_slots (doctor_id, start_time, end_time, status)
                VALUES (:doctor_id, :start_time, :end_time, 'available')
                """
            ),
            {"doctor_id": 1, "start_time": start_time, "end_time": end_time},
        )
        await db.commit()

        workflow = BookingWorkflowService(db)
        appointment_id = await workflow.reserve_slot(slot_id=1, patient_id=100, priority="normal")
        assert appointment_id > 0

    relay = OutboxRelay(
        session_factory=eventing_db_factory,
        rabbitmq_url="amqp://fake",
        exchange_name="agenda.events",
        batch_size=100,
        poll_interval_seconds=0.1,
    )
    published_count = await relay._publish_batch()
    assert published_count == 2
    assert len(published) == 2

    async with eventing_db_factory() as db:
        pending = await db.scalar(text("SELECT COUNT(*) FROM outbox_events WHERE status = 'pending'"))
        done = await db.scalar(text("SELECT COUNT(*) FROM outbox_events WHERE status = 'published'"))
        assert int(pending or 0) == 0
        assert int(done or 0) == 2

    appointment_created = None
    for msg in published:
        payload = json.loads(msg["body"].decode("utf-8"))
        if payload["event_type"] == "AppointmentCreated":
            appointment_created = payload
            break

    assert appointment_created is not None

    async with eventing_db_factory() as db:
        dispatcher = NotificationDispatcher(db, consumer_name="notifications")

        async def _noop(_event):
            return None

        dispatcher._send_whatsapp_confirmation = _noop  # type: ignore[assignment]
        dispatcher._send_email_confirmation = _noop  # type: ignore[assignment]

        first = await dispatcher.handle_event(appointment_created)
        second = await dispatcher.handle_event(appointment_created)
        assert first == "processed"
        assert second == "duplicate_ignored"

        processed_count = await db.scalar(
            text("SELECT COUNT(*) FROM processed_events WHERE consumer_name = 'notifications'")
        )
        assert int(processed_count or 0) == 1


@pytest.mark.integration
@pytest.mark.asyncio
async def test_cancel_emits_outbox_event(eventing_db_factory):
    async with eventing_db_factory() as db:
        await db.execute(text("INSERT INTO doctors (id) VALUES (1)"))
        await db.execute(text("INSERT INTO patients (id) VALUES (101)"))
        start_time = datetime(2026, 4, 6, 10, 0, 0)
        end_time = start_time + timedelta(minutes=30)
        await db.execute(
            text(
                """
                INSERT INTO time_slots (doctor_id, start_time, end_time, status)
                VALUES (:doctor_id, :start_time, :end_time, 'available')
                """
            ),
            {"doctor_id": 1, "start_time": start_time, "end_time": end_time},
        )
        await db.commit()

        workflow = BookingWorkflowService(db)
        appointment_id = await workflow.reserve_slot(slot_id=1, patient_id=101, priority="normal")
        released_slot_id = await workflow.cancel_appointment(appointment_id=appointment_id, reason="patient_request")

        assert released_slot_id == 1

        cancel_events = await db.scalar(
            text("SELECT COUNT(*) FROM outbox_events WHERE event_type = 'AppointmentCancelled'")
        )
        assert int(cancel_events or 0) == 1
