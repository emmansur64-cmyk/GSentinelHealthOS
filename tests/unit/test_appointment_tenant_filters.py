from __future__ import annotations

from uuid import uuid4

import pytest

from api.app.services.appointment_service import AppointmentService


class _FakeScalars:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows

    def first(self):
        return self._rows[0] if self._rows else None


class _FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return _FakeScalars(self._rows)


class FakeDB:
    def __init__(self) -> None:
        self.last_stmt = None

    async def execute(self, stmt):
        self.last_stmt = stmt
        return _FakeResult([])


@pytest.mark.asyncio
async def test_get_doctor_appointments_applies_client_filter() -> None:
    db = FakeDB()
    service = AppointmentService(db)

    doctor_id = uuid4()
    client_id = uuid4()

    result = await service.get_doctor_appointments(doctor_id=doctor_id, client_id=client_id)

    assert result == []
    assert db.last_stmt is not None
    where_clause = str(db.last_stmt.whereclause)
    assert "appointments.doctor_id" in where_clause
    assert "appointments.client_id" in where_clause


@pytest.mark.asyncio
async def test_get_patient_appointments_applies_client_filter() -> None:
    db = FakeDB()
    service = AppointmentService(db)

    patient_id = uuid4()
    client_id = uuid4()

    result = await service.get_patient_appointments(patient_id=patient_id, client_id=client_id)

    assert result == []
    assert db.last_stmt is not None
    where_clause = str(db.last_stmt.whereclause)
    assert "appointments.patient_id" in where_clause
    assert "appointments.client_id" in where_clause
