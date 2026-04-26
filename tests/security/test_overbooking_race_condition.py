import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from api.app.models.models import Doctor, Patient


pytestmark = [pytest.mark.integration, pytest.mark.requires_db]


API_BASE_URL = os.getenv("GSENTINEL_API_BASE_URL", "http://localhost:8000")
GATEWAY_API_KEY = os.getenv("GATEWAY_API_KEY")
DISALLOWED_KEYS = {"gateway-secret-key-change-production", "change-me-gateway-key"}
SQLITE_SEED_DB_PATH = os.getenv("GSENTINEL_SQLITE_SEED_DB_PATH")


async def _create_patient(client: httpx.AsyncClient) -> str:
    suffix = uuid.uuid4().hex[:10]
    payload = {
        "name": f"Paciente Race {suffix}",
        "phone": f"+341{uuid.uuid4().int % 900000000 + 100000000}",
        "email": f"race.patient.{suffix}@mail.com",
    }
    response = await client.post(f"{API_BASE_URL}/api/v1/patients/", json=payload)
    response.raise_for_status()
    return response.json()["id"]


async def _create_doctor(client: httpx.AsyncClient) -> str:
    suffix = uuid.uuid4().hex[:10]
    payload = {
        "name": f"Dr Race {suffix}",
        "specialty": "Medicina General",
        "phone": f"+349{uuid.uuid4().int % 900000000 + 100000000}",
        "email": f"race.doctor.{suffix}@hospital.com",
        "license_number": f"LIC-{suffix}",
    }
    response = await client.post(f"{API_BASE_URL}/api/v1/doctors/", json=payload)
    response.raise_for_status()
    return response.json()["id"]


def _seed_entities_sqlite(db_path: str) -> tuple[str, str, str]:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    doctor_id = uuid.uuid4()
    patient_a_id = uuid.uuid4()
    patient_b_id = uuid.uuid4()

    engine = create_engine(f"sqlite:///{db_path}")
    try:
        with Session(engine) as session:
            session.add(
                Doctor(
                    id=doctor_id,
                    name=f"Dr Race Seed {str(doctor_id)[:8]}",
                    specialization="Medicina General",
                    email=f"race.seed.doctor.{str(doctor_id)[:8]}@hospital.com",
                    phone=f"+349{uuid.uuid4().int % 900000000 + 100000000}",
                    is_active=True,
                    created_at=now,
                    updated_at=now,
                )
            )

            for patient_id in (patient_a_id, patient_b_id):
                session.add(
                    Patient(
                        id=patient_id,
                        name=f"Paciente Race Seed {str(patient_id)[:8]}",
                        phone=f"+341{uuid.uuid4().int % 900000000 + 100000000}",
                        email=f"race.seed.patient.{str(patient_id)[:8]}@mail.com",
                        created_at=now,
                        updated_at=now,
                    )
                )

            session.commit()
    finally:
        engine.dispose()

    return str(doctor_id), str(patient_a_id), str(patient_b_id)


@pytest.mark.asyncio
async def test_simultaneous_booking_allows_single_winner_only() -> None:
    """Valida que dos reservas simultáneas al mismo slot no creen overbooking."""
    if not GATEWAY_API_KEY:
        pytest.fail("Falta GATEWAY_API_KEY en entorno; no se permite usar credenciales demo hardcodeadas")
    gateway_api_key = GATEWAY_API_KEY
    if gateway_api_key in DISALLOWED_KEYS:
        pytest.fail("GATEWAY_API_KEY apunta a valor demo/inseguro; define una clave enterprise real")

    timeout = httpx.Timeout(timeout=30.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        if SQLITE_SEED_DB_PATH:
            doctor_id, patient_a_id, patient_b_id = _seed_entities_sqlite(SQLITE_SEED_DB_PATH)
        else:
            doctor_id = await _create_doctor(client)
            patient_a_id = await _create_patient(client)
            patient_b_id = await _create_patient(client)

        appointment_time = (datetime.now(timezone.utc) + timedelta(days=1)).replace(microsecond=0)

        async def book(patient_id: str, session_id: int) -> tuple[int, int, dict]:
            payload = {
                "doctor_id": doctor_id,
                "patient_id": patient_id,
                "date_time": appointment_time.isoformat(),
                "reason": f"race-session-{session_id}",
                "status": "scheduled",
            }
            response = await client.post(
                f"{API_BASE_URL}/api/v1/appointments",
                json=payload,
                headers={"X-Internal-Key": gateway_api_key},
            )
            body = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
            return session_id, response.status_code, body

        results = await asyncio.gather(
            book(patient_a_id, 1),
            book(patient_b_id, 2),
        )

        successful = [entry for entry in results if entry[1] == 201]
        conflicts = [entry for entry in results if entry[1] in {409, 422}]

        assert len(successful) == 1, f"Se esperaba exactamente 1 éxito, resultado: {results}"
        assert len(conflicts) == 1, f"Se esperaba exactamente 1 rechazo por conflicto, resultado: {results}"

        check_response = await client.get(
            f"{API_BASE_URL}/api/v1/appointments/doctor/{doctor_id}",
            params={"date_from": appointment_time.isoformat()},
            headers={"X-Internal-Key": gateway_api_key},
        )
        check_response.raise_for_status()

        appointments = check_response.json()
        matching = [a for a in appointments if a.get("date_time", "").startswith(appointment_time.strftime("%Y-%m-%dT%H:%M:%S"))]
        assert len(matching) == 1, f"Overbooking detectado: {matching}"
