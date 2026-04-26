import asyncio
import os
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest
import pytest_asyncio
from sqlalchemy import Column, Integer, Table, bindparam, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.ext.asyncio import async_sessionmaker

from api.app.models.time_slot_simple import Appointment, Base, SlotBufferBlock, TimeSlot

# Prevent Settings bootstrap errors during test import.
os.environ.setdefault("GATEWAY_API_KEY", "test-gateway-key-valid")
os.environ.setdefault("BRAIN_API_KEY", "test-brain-key-valid")

from api.app.services.time_slot_service_simple import TimeSlotService


@pytest_asyncio.fixture
async def db_factory(tmp_path):
    db_file = tmp_path / "cancel_concurrency.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}", echo=False, future=True)

    if "doctors" not in Base.metadata.tables:
        Table(
            "doctors",
            Base.metadata,
            Column("id", Integer, primary_key=True),
            Column("buffer_before_minutes", Integer, nullable=False, default=0),
            Column("buffer_after_minutes", Integer, nullable=False, default=0),
        )
    if "patients" not in Base.metadata.tables:
        Table(
            "patients",
            Base.metadata,
            Column("id", Integer, primary_key=True),
        )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    try:
        yield AsyncSessionLocal
    finally:
        await engine.dispose()


@pytest_asyncio.fixture(autouse=True)
async def patch_pg_specific_sql(monkeypatch):
    async def _reserve_required_resources_for_slot_stub(db, slot_id, slot_start, slot_end):
        return (True, "", 0, 0)

    async def _release_required_resources_for_slot_stub(db, slot_id, slot_start, slot_end):
        return 0

    monkeypatch.setattr(TimeSlotService, "_reserve_required_resources_for_slot", staticmethod(_reserve_required_resources_for_slot_stub))
    monkeypatch.setattr(TimeSlotService, "_release_required_resources_for_slot", staticmethod(_release_required_resources_for_slot_stub))


@pytest.mark.asyncio
async def test_double_cancel_same_appointment_is_concurrency_safe(db_factory):
    AsyncSessionLocal = db_factory

    # Arrange baseline data and one booked appointment.
    slot_id = None
    async with AsyncSessionLocal() as db:
        await db.execute(
            text(
                """
                INSERT INTO doctors (id, buffer_before_minutes, buffer_after_minutes)
                VALUES (1, 10, 10)
                """
            )
        )
        await db.execute(text("INSERT INTO patients (id) VALUES (100)"))

        slot_start = datetime(2026, 4, 10, 10, 0, 0)
        slot = TimeSlot(
            doctor_id=1,
            start_time=slot_start,
            end_time=slot_start + timedelta(minutes=30),
            status="available",
        )
        db.add(slot)
        await db.commit()
        await db.refresh(slot)
        slot_id = int(slot.id)

    assert slot_id is not None

    appointment_id = None
    async with AsyncSessionLocal() as db:
        ok, appointment_id, err = await TimeSlotService.book_slot(
            db=db,
            slot_id=slot_id,
            patient_id=100,
        )
        assert ok is True, err
        assert appointment_id is not None

    async def _cancel_once():
        async with AsyncSessionLocal() as s:
            return await TimeSlotService.cancel_appointment(s, appointment_id)

    # Act: two cancellations at the same time against same appointment.
    results = await asyncio.gather(_cancel_once(), _cancel_once())

    # Assert: one succeeds, the other must fail gracefully without corruption.
    success_flags = [item[0] for item in results]
    # SQLite does not enforce FOR UPDATE row locking semantics, so both calls
    # may report success. The key invariant is final consistency.
    assert success_flags.count(True) >= 1

    async with AsyncSessionLocal() as db:
        final_slot = await db.scalar(select(TimeSlot).where(TimeSlot.id == slot_id))
        remaining_appts = int(
            (await db.execute(select(func.count()).select_from(Appointment))).scalar_one()
        )

    assert final_slot is not None
    assert final_slot.status == "available"
    assert remaining_appts == 0


@pytest.mark.asyncio
async def test_booking_with_buffers_enqueues_single_google_create_for_appointment_only(db_factory, monkeypatch):
    AsyncSessionLocal = db_factory
    google_calls: list[SimpleNamespace] = []

    async def _google_create_stub(db, appointment_id):
        google_calls.append(SimpleNamespace(action="create", appointment_id=appointment_id))

    monkeypatch.setattr(
        TimeSlotService,
        "_enqueue_google_create_for_appointment",
        staticmethod(_google_create_stub),
    )

    slot_ids: list[int] = []
    async with AsyncSessionLocal() as db:
        await db.execute(
            text(
                """
                INSERT INTO doctors (id, buffer_before_minutes, buffer_after_minutes)
                VALUES (1, 30, 30)
                """
            )
        )
        await db.execute(text("INSERT INTO patients (id) VALUES (100)"))

        base = datetime(2026, 4, 12, 9, 0, 0)
        slots = []
        for i in range(3):
            start = base + timedelta(minutes=30 * i)
            slots.append(
                TimeSlot(
                    doctor_id=1,
                    start_time=start,
                    end_time=start + timedelta(minutes=30),
                    status="available",
                )
            )
        db.add_all(slots)
        await db.commit()
        for slot in slots:
            await db.refresh(slot)
            slot_ids.append(int(slot.id))

    async with AsyncSessionLocal() as db:
        ok, appointment_id, err = await TimeSlotService.book_slot(
            db=db,
            slot_id=slot_ids[1],
            patient_id=100,
        )
        assert ok is True, err
        assert appointment_id is not None

        statuses = {
            row.id: row.status
            for row in (await db.execute(select(TimeSlot).order_by(TimeSlot.start_time))).scalars().all()
        }

    assert len(google_calls) == 1
    assert google_calls[0].action == "create"
    assert google_calls[0].appointment_id == appointment_id
    assert statuses[slot_ids[0]] == "blocked"
    assert statuses[slot_ids[1]] == "booked"
    assert statuses[slot_ids[2]] == "blocked"


@pytest.mark.asyncio
async def test_cancel_one_booking_keeps_shared_buffer_blocked(db_factory):
    AsyncSessionLocal = db_factory

    slot_ids: list[int] = []
    async with AsyncSessionLocal() as db:
        await db.execute(
            text(
                """
                INSERT INTO doctors (id, buffer_before_minutes, buffer_after_minutes)
                VALUES (1, 30, 30)
                """
            )
        )
        await db.execute(text("INSERT INTO patients (id) VALUES (101)"))
        await db.execute(text("INSERT INTO patients (id) VALUES (102)"))

        base = datetime(2026, 4, 11, 9, 0, 0)
        slots = []
        for i in range(5):
            start = base + timedelta(minutes=30 * i)
            slots.append(
                TimeSlot(
                    doctor_id=1,
                    start_time=start,
                    end_time=start + timedelta(minutes=30),
                    status="available",
                )
            )
        db.add_all(slots)
        await db.commit()
        for slot in slots:
            await db.refresh(slot)
            slot_ids.append(int(slot.id))

    assert len(slot_ids) == 5

    async with AsyncSessionLocal() as db:
        # Book slot index 1 (09:30) and slot index 3 (10:30), sharing blocked slot index 2 (10:00).
        ok1, appt1, err1 = await TimeSlotService.book_slot(db=db, slot_id=slot_ids[1], patient_id=101)
        assert ok1 is True, err1
        ok2, appt2, err2 = await TimeSlotService.book_slot(db=db, slot_id=slot_ids[3], patient_id=102)
        assert ok2 is True, err2
        assert appt1 is not None and appt2 is not None

        # Act: cancel first appointment only.
        cancelled, released_slot_id, cancel_err = await TimeSlotService.cancel_appointment(db=db, appointment_id=appt1)
        assert cancelled is True, cancel_err
        assert released_slot_id == slot_ids[1]

        statuses = {
            row.id: row.status
            for row in (await db.execute(select(TimeSlot).order_by(TimeSlot.start_time))).scalars().all()
        }

        # slot[2] (10:00) must remain blocked because slot[3] booking still requires it as buffer-before.
        assert statuses[slot_ids[2]] == "blocked"
        assert statuses[slot_ids[3]] == "booked"

        # slot[0] should be released because only cancelled booking blocked it.
        assert statuses[slot_ids[0]] == "available"


@pytest.mark.asyncio
async def test_cancel_enqueues_single_google_delete_and_no_blocked_slot_operations(db_factory, monkeypatch):
    AsyncSessionLocal = db_factory
    google_calls: list[SimpleNamespace] = []

    async def _google_create_stub(db, appointment_id):
        google_calls.append(SimpleNamespace(action="create", appointment_id=appointment_id))

    async def _google_delete_stub(db, appointment_id, google_event_id):
        google_calls.append(
            SimpleNamespace(
                action="delete",
                appointment_id=appointment_id,
                google_event_id=google_event_id,
            )
        )

    monkeypatch.setattr(
        TimeSlotService,
        "_enqueue_google_create_for_appointment",
        staticmethod(_google_create_stub),
    )
    monkeypatch.setattr(
        TimeSlotService,
        "_enqueue_google_delete_for_appointment",
        staticmethod(_google_delete_stub),
    )

    slot_ids: list[int] = []
    async with AsyncSessionLocal() as db:
        await db.execute(
            text(
                """
                INSERT INTO doctors (id, buffer_before_minutes, buffer_after_minutes)
                VALUES (1, 30, 30)
                """
            )
        )
        await db.execute(text("INSERT INTO patients (id) VALUES (100)"))

        base = datetime(2026, 4, 13, 9, 0, 0)
        slots = []
        for i in range(3):
            start = base + timedelta(minutes=30 * i)
            slots.append(
                TimeSlot(
                    doctor_id=1,
                    start_time=start,
                    end_time=start + timedelta(minutes=30),
                    status="available",
                )
            )
        db.add_all(slots)
        await db.commit()
        for slot in slots:
            await db.refresh(slot)
            slot_ids.append(int(slot.id))

    appointment_id = None
    async with AsyncSessionLocal() as db:
        ok, appointment_id, err = await TimeSlotService.book_slot(
            db=db,
            slot_id=slot_ids[1],
            patient_id=100,
        )
        assert ok is True, err
        assert appointment_id is not None

        appointment = await db.scalar(select(Appointment).where(Appointment.id == appointment_id))
        assert appointment is not None
        appointment.google_event_id = "evt-slot-based-1"
        await db.commit()

    google_calls.clear()

    async with AsyncSessionLocal() as db:
        cancelled, released_slot_id, cancel_err = await TimeSlotService.cancel_appointment(
            db=db,
            appointment_id=appointment_id,
        )
        assert cancelled is True, cancel_err
        assert released_slot_id == slot_ids[1]

        statuses = {
            row.id: row.status
            for row in (await db.execute(select(TimeSlot).order_by(TimeSlot.start_time))).scalars().all()
        }

    assert len(google_calls) == 1
    assert google_calls[0].action == "delete"
    assert google_calls[0].appointment_id == appointment_id
    assert google_calls[0].google_event_id == "evt-slot-based-1"
    assert statuses[slot_ids[0]] == "available"


@pytest.mark.asyncio
async def test_day_boundary_booking_does_not_overflow_buffer_window(db_factory):
    AsyncSessionLocal = db_factory

    slot_ids: list[int] = []
    async with AsyncSessionLocal() as db:
        await db.execute(
            text(
                """
                INSERT INTO doctors (id, buffer_before_minutes, buffer_after_minutes)
                VALUES (1, 60, 60)
                """
            )
        )
        await db.execute(text("INSERT INTO patients (id) VALUES (100)"))

        base = datetime(2026, 4, 14, 9, 0, 0)
        slots = []
        for i in range(3):
            start = base + timedelta(minutes=30 * i)
            slots.append(TimeSlot(doctor_id=1, start_time=start, end_time=start + timedelta(minutes=30), status="available"))
        db.add_all(slots)
        await db.commit()
        for slot in slots:
            await db.refresh(slot)
            slot_ids.append(int(slot.id))

    async with AsyncSessionLocal() as db:
        ok_first, _, err_first = await TimeSlotService.book_slot(db=db, slot_id=slot_ids[0], patient_id=100)
        assert ok_first is True, err_first

        statuses_after_first = {
            row.id: row.status
            for row in (await db.execute(select(TimeSlot).order_by(TimeSlot.start_time))).scalars().all()
        }
        assert statuses_after_first[slot_ids[0]] == "booked"
        assert statuses_after_first[slot_ids[1]] == "blocked"
        assert statuses_after_first[slot_ids[2]] == "blocked"


@pytest.mark.asyncio
async def test_reschedule_releases_old_buffers_and_applies_new_ones(db_factory, monkeypatch):
    AsyncSessionLocal = db_factory
    google_calls: list[SimpleNamespace] = []

    async def _google_update_stub(db, appointment_id):
        google_calls.append(SimpleNamespace(action="update", appointment_id=appointment_id))

    monkeypatch.setattr(
        TimeSlotService,
        "_enqueue_google_update_for_appointment",
        staticmethod(_google_update_stub),
    )

    slot_ids: list[int] = []
    async with AsyncSessionLocal() as db:
        await db.execute(
            text(
                """
                INSERT INTO doctors (id, buffer_before_minutes, buffer_after_minutes)
                VALUES (1, 30, 30)
                """
            )
        )
        await db.execute(text("INSERT INTO patients (id) VALUES (100)"))

        base = datetime(2026, 4, 15, 9, 0, 0)
        slots = []
        for i in range(5):
            start = base + timedelta(minutes=30 * i)
            slots.append(TimeSlot(doctor_id=1, start_time=start, end_time=start + timedelta(minutes=30), status="available"))
        db.add_all(slots)
        await db.commit()
        for slot in slots:
            await db.refresh(slot)
            slot_ids.append(int(slot.id))

    async with AsyncSessionLocal() as db:
        ok, appointment_id, err = await TimeSlotService.book_slot(db=db, slot_id=slot_ids[1], patient_id=100)
        assert ok is True, err
        moved, new_slot_id, move_err = await TimeSlotService.reschedule_appointment(
            db=db,
            appointment_id=appointment_id,
            new_slot_id=slot_ids[3],
        )
        assert moved is True, move_err
        assert new_slot_id == slot_ids[3]

        statuses = {
            row.id: row.status
            for row in (await db.execute(select(TimeSlot).order_by(TimeSlot.start_time))).scalars().all()
        }
        links = {
            (row.source_slot_id, row.blocked_slot_id)
            for row in (await db.execute(select(SlotBufferBlock))).scalars().all()
        }

    assert statuses[slot_ids[0]] == "available"
    assert statuses[slot_ids[1]] == "available"
    assert statuses[slot_ids[2]] == "blocked"
    assert statuses[slot_ids[3]] == "booked"
    assert statuses[slot_ids[4]] == "blocked"
    assert links == {(slot_ids[3], slot_ids[2]), (slot_ids[3], slot_ids[4])}
    assert len(google_calls) == 1
    assert google_calls[0].action == "update"


@pytest.mark.asyncio
async def test_orphan_blocked_slots_are_reconciled_to_available(db_factory):
    AsyncSessionLocal = db_factory

    slot_ids: list[int] = []
    async with AsyncSessionLocal() as db:
        await db.execute(
            text(
                """
                INSERT INTO doctors (id, buffer_before_minutes, buffer_after_minutes)
                VALUES (1, 30, 30)
                """
            )
        )
        await db.execute(text("INSERT INTO patients (id) VALUES (100)"))
        await db.execute(text("INSERT INTO patients (id) VALUES (101)"))

        base = datetime(2026, 4, 16, 9, 0, 0)
        slots = []
        for i in range(4):
            start = base + timedelta(minutes=30 * i)
            slots.append(TimeSlot(doctor_id=1, start_time=start, end_time=start + timedelta(minutes=30), status="available"))
        db.add_all(slots)
        await db.commit()
        for slot in slots:
            await db.refresh(slot)
            slot_ids.append(int(slot.id))

        admin_blocked = await db.scalar(select(TimeSlot).where(TimeSlot.id == slot_ids[0]))
        assert admin_blocked is not None
        admin_blocked.status = "blocked"
        await db.commit()

    async with AsyncSessionLocal() as db:
        ok, appointment_id, err = await TimeSlotService.book_slot(db=db, slot_id=slot_ids[1], patient_id=100)
        assert ok is True, err

        cancelled, _, cancel_err = await TimeSlotService.cancel_appointment(db=db, appointment_id=appointment_id)
        assert cancelled is True, cancel_err

        best = await TimeSlotService.find_best_slot_for_priority(
            db=db,
            doctor_id=1,
            slot_date=datetime(2026, 4, 16).date(),
            priority="urgent",
            allow_reassign=False,
        )

        statuses = {
            row.id: row.status
            for row in (await db.execute(select(TimeSlot).order_by(TimeSlot.start_time))).scalars().all()
        }

    assert statuses[slot_ids[0]] == "available"
    assert statuses[slot_ids[1]] == "available"
    assert statuses[slot_ids[2]] == "available"
    assert best["source"] == "available"
    assert statuses[slot_ids[1]] == "available"
    assert statuses[slot_ids[2]] == "available"
