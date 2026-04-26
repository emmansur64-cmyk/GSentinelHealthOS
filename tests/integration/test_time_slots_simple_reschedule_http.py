from __future__ import annotations

import os
from datetime import datetime, timedelta

import pytest
import pytest_asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Column, Integer, Table, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


os.environ.setdefault("GATEWAY_API_KEY", "test-gateway-key-valid")
os.environ.setdefault("BRAIN_API_KEY", "test-brain-key-valid")

from api.app.api.v1.endpoints.time_slots_simple import router as slots_router
from api.app.db.session import get_db
from api.app.models.time_slot_simple import Appointment, Base, TimeSlot
from api.app.services.time_slot_service_simple import TimeSlotService


@pytest_asyncio.fixture
async def db_factory(tmp_path):
    db_file = tmp_path / "integration_reschedule_http.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}", echo=False, future=True)

    if "doctors" not in Base.metadata.tables:
        Table(
            "doctors",
            Base.metadata,
            Column("id", Integer, primary_key=True),
            Column("buffer_before_minutes", Integer, nullable=False, default=0),
            Column("buffer_after_minutes", Integer, nullable=False, default=0),
            Column("specialization", Integer, nullable=True),
        )
    if "patients" not in Base.metadata.tables:
        Table(
            "patients",
            Base.metadata,
            Column("id", Integer, primary_key=True),
        )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        yield session_factory
    finally:
        await engine.dispose()


@pytest.mark.integration
@pytest.mark.asyncio
async def test_http_reschedule_endpoint_moves_appointment_and_updates_buffers(db_factory, monkeypatch):
    async def _reserve_required_resources_stub(db, slot_id, slot_start, slot_end):
        return (True, "", 0, 0)

    async def _release_required_resources_stub(db, slot_id, slot_start, slot_end):
        return 0

    async def _google_update_noop(db, appointment_id):
        return None

    monkeypatch.setattr(
        TimeSlotService,
        "_reserve_required_resources_for_slot",
        staticmethod(_reserve_required_resources_stub),
    )
    monkeypatch.setattr(
        TimeSlotService,
        "_release_required_resources_for_slot",
        staticmethod(_release_required_resources_stub),
    )
    monkeypatch.setattr(
        TimeSlotService,
        "_enqueue_google_update_for_appointment",
        staticmethod(_google_update_noop),
    )

    async with db_factory() as db:
        await db.execute(
            text(
                """
                INSERT INTO doctors (id, buffer_before_minutes, buffer_after_minutes)
                VALUES (1, 30, 30)
                """
            )
        )
        await db.execute(text("INSERT INTO patients (id) VALUES (100)"))

        base = datetime(2026, 4, 20, 9, 0, 0)
        slots = []
        for i in range(5):
            start = base + timedelta(minutes=30 * i)
            slots.append(TimeSlot(doctor_id=1, start_time=start, end_time=start + timedelta(minutes=30), status="available"))
        db.add_all(slots)
        await db.commit()
        for slot in slots:
            await db.refresh(slot)

        slot_ids = [int(slot.id) for slot in slots]
        ok, appointment_id, err = await TimeSlotService.book_slot(db=db, slot_id=slot_ids[1], patient_id=100)
        assert ok is True, err
        assert appointment_id is not None

    app = FastAPI()
    app.include_router(slots_router)

    async def _override_get_db():
        async with db_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db

    with TestClient(app) as client:
        response = client.post(
            f"/api/v1/slots/appointments/{appointment_id}/reschedule",
            json={"new_slot_id": slot_ids[3]},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["slot_id"] == slot_ids[3]

    async with db_factory() as db:
        appointment = await db.scalar(select(Appointment).where(Appointment.id == appointment_id))
        assert appointment is not None
        assert int(appointment.slot_id) == slot_ids[3]

        statuses = {
            row.id: row.status
            for row in (await db.execute(select(TimeSlot).order_by(TimeSlot.start_time))).scalars().all()
        }

    assert statuses[slot_ids[1]] == "available"
    assert statuses[slot_ids[3]] == "booked"
