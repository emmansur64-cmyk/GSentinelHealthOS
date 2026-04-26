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
from api.app.eventing.booking_workflows import BookingWorkflowService
from api.app.application import (
    BestSlotQueryResult,
    BookNextByPriorityResult,
    ReassignmentAuditResult,
    RescheduleAppointmentResult,
    UrgentSlaMetricsResult,
)
from api.app.db.session import get_db
from api.app.infrastructure import SqlAlchemySlotBookingGateway
from api.app.models.time_slot_simple import Base, TimeSlot
from api.app.services.time_slot_service_simple import TimeSlotService


@pytest_asyncio.fixture
async def db_factory(tmp_path):
    db_file = tmp_path / "integration_clean_arch_contract.db"
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


@pytest.fixture
def app_client(db_factory, monkeypatch):
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

    app = FastAPI()
    app.include_router(slots_router)

    async def _override_get_db():
        async with db_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db

    with TestClient(app) as client:
        yield client


async def _seed_base_data(db_factory):
    async with db_factory() as db:
        await db.execute(text("INSERT INTO doctors (id, buffer_before_minutes, buffer_after_minutes) VALUES (1, 0, 0)"))
        await db.execute(text("INSERT INTO patients (id) VALUES (100), (101), (102), (103), (104)"))

        base = datetime(2026, 4, 20, 9, 0, 0)
        slots = []
        for i in range(6):
            start = base + timedelta(minutes=30 * i)
            slots.append(TimeSlot(doctor_id=1, start_time=start, end_time=start + timedelta(minutes=30), status="available"))
        db.add_all(slots)
        await db.commit()
        for slot in slots:
            await db.refresh(slot)

        return [int(slot.id) for slot in slots]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_http_book_contract_kept(db_factory, app_client, monkeypatch):
    slot_ids = await _seed_base_data(db_factory)

    async def _reserve_ok(self, **kwargs):
        _ = kwargs
        return 9001

    monkeypatch.setattr(BookingWorkflowService, "reserve_slot", _reserve_ok)

    response = app_client.post(
        "/api/v1/slots/book",
        json={"slot_id": slot_ids[0], "patient_id": 100, "priority": "normal", "allow_reassign": False},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["success"] is True
    assert payload["appointment_id"] is not None
    assert payload["error"] == ""


@pytest.mark.integration
@pytest.mark.asyncio
async def test_http_book_next_by_priority_contract_kept(db_factory, app_client, monkeypatch):
    slot_ids = await _seed_base_data(db_factory)

    async def _book_next_ok(self, request):
        return BookNextByPriorityResult(
            success=True,
            appointment_id=9100,
            slot_id=slot_ids[1],
            booking_source="available",
            error="",
        )

    monkeypatch.setattr(SqlAlchemySlotBookingGateway, "book_next_by_priority", _book_next_ok)

    response = app_client.post(
        "/api/v1/slots/book-next-by-priority",
        json={
            "doctor_id": 1,
            "slot_date": "2026-04-20T00:00:00",
            "patient_id": 102,
            "priority": "normal",
            "allow_reassign": False,
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["success"] is True
    assert payload["appointment_id"] is not None
    assert payload["booking_source"] in {"available", "blocked", "reassign"}


@pytest.mark.integration
@pytest.mark.asyncio
async def test_http_cancel_contract_kept(db_factory, app_client, monkeypatch):
    slot_ids = await _seed_base_data(db_factory)

    async def _cancel_ok(self, **kwargs):
        _ = kwargs
        return slot_ids[1]

    monkeypatch.setattr(BookingWorkflowService, "cancel_appointment", _cancel_ok)

    response = app_client.post("/api/v1/slots/appointments/1234/cancel")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["slot_id"] == slot_ids[1]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_http_reschedule_contract_kept(db_factory, app_client, monkeypatch):
    slot_ids = await _seed_base_data(db_factory)

    async def _reschedule_ok(self, request):
        return RescheduleAppointmentResult(success=True, slot_id=slot_ids[4], error="")

    monkeypatch.setattr(SqlAlchemySlotBookingGateway, "reschedule_appointment", _reschedule_ok)

    response = app_client.post(
        "/api/v1/slots/appointments/5000/reschedule",
        json={"new_slot_id": slot_ids[4]},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["slot_id"] == slot_ids[4]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_http_best_slot_contract_kept(db_factory, app_client, monkeypatch):
    slot_ids = await _seed_base_data(db_factory)

    async def _best_slot_ok(self, request):
        return BestSlotQueryResult(slot_id=slot_ids[0], source="available")

    monkeypatch.setattr(SqlAlchemySlotBookingGateway, "find_best_slot", _best_slot_ok)

    response = app_client.get(
        "/api/v1/slots/best-slot",
        params={"doctor_id": 1, "date": "2026-04-20", "priority": "normal", "allow_reassign": False},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["slot_id"] == slot_ids[0]
    assert payload["source"] == "available"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_http_reassignment_audit_contract_kept(db_factory, app_client, monkeypatch):
    await _seed_base_data(db_factory)

    async def _audit_ok(self, request):
        return ReassignmentAuditResult(
            items=[
                {
                    "id": 1,
                    "doctor_id": 1,
                    "displaced_appointment_id": 10,
                    "urgent_appointment_id": 11,
                    "old_slot_id": 100,
                    "new_slot_id": 101,
                    "displaced_by_user_id": 1,
                    "reason": "urgent case",
                    "urgent_wait_minutes": 20,
                    "sla_target_minutes": 60,
                    "sla_breached": False,
                    "created_at": datetime(2026, 4, 20, 9, 0, 0),
                }
            ]
        )

    monkeypatch.setattr(SqlAlchemySlotBookingGateway, "get_reassignment_audit", _audit_ok)

    response = app_client.get("/api/v1/slots/reassignment-audit", params={"doctor_id": 1, "limit": 50})

    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert len(payload) == 1
    assert payload[0]["doctor_id"] == 1
    assert payload[0]["urgent_appointment_id"] == 11


@pytest.mark.integration
@pytest.mark.asyncio
async def test_http_urgent_sla_contract_kept(db_factory, app_client, monkeypatch):
    await _seed_base_data(db_factory)

    async def _sla_ok(self, request):
        return UrgentSlaMetricsResult(
            payload={
                "doctor_id": 1,
                "window_days": 30,
                "urgent_total": 5,
                "displaced_total": 1,
                "displacement_rate_percent": 20.0,
                "avg_urgent_wait_minutes": 18.5,
            }
        )

    monkeypatch.setattr(SqlAlchemySlotBookingGateway, "get_urgent_sla_metrics", _sla_ok)

    response = app_client.get("/api/v1/slots/urgent-sla", params={"doctor_id": 1, "days": 30})

    assert response.status_code == 200
    payload = response.json()
    assert payload["doctor_id"] == 1
    assert payload["window_days"] == 30
    assert payload["urgent_total"] == 5
