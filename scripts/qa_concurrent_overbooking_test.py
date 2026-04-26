"""QA concurrent test: 20 simultaneous bookings for same doctor + datetime.

Expected:
- Exactly 1 successful creation
- Exactly 19 HTTP 409 conflicts
- Exactly 1 row persisted for (doctor_id, slot)
"""

from __future__ import annotations

import argparse
import asyncio
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
import psycopg
from dotenv import load_dotenv
from psycopg import sql


DISALLOWED_KEYS = {"gateway-secret-key-change-production", "change-me-gateway-key"}


@dataclass
class TestContext:
    doctor_id: uuid.UUID
    patient_ids: list[uuid.UUID]
    slot: datetime
    appointment_time_column: str


def _database_url_for_psycopg(raw_database_url: str) -> str:
    if raw_database_url.startswith("postgresql+psycopg://"):
        return raw_database_url.replace("postgresql+psycopg://", "postgresql://", 1)
    if raw_database_url.startswith("postgresql://"):
        return raw_database_url
    raise RuntimeError("DATABASE_URL debe ser PostgreSQL para este test QA")


def _existing_columns(conn: psycopg.Connection[Any], table_name: str) -> set[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = %s
            """,
            (table_name,),
        )
        return {row[0] for row in cur.fetchall()}


def _insert_dynamic_row(
    conn: psycopg.Connection[Any],
    table_name: str,
    values: dict[str, Any],
) -> None:
    keys = list(values.keys())
    placeholders = sql.SQL(", ").join(sql.Placeholder() for _ in keys)
    query = sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
        sql.Identifier(table_name),
        sql.SQL(", ").join(sql.Identifier(k) for k in keys),
        placeholders,
    )
    with conn.cursor() as cur:
        cur.execute(query, [values[k] for k in keys])


def _resolve_appointment_time_column(conn: psycopg.Connection[Any]) -> str:
    columns = _existing_columns(conn, "appointments")
    for candidate in ("date_time", "datetime", "appointment_date"):
        if candidate in columns:
            return candidate
    raise RuntimeError("appointments no tiene date_time/datetime/appointment_date")


def _seed_entities(conn: psycopg.Connection[Any], total_patients: int) -> tuple[uuid.UUID, list[uuid.UUID]]:
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    doctor_columns = _existing_columns(conn, "doctors")
    patient_columns = _existing_columns(conn, "patients")

    doctor_id = uuid.uuid4()
    doctor_values: dict[str, Any] = {
        "id": doctor_id,
        "name": f"QA Doctor {doctor_id.hex[:8]}",
        "email": f"qa.doctor.{doctor_id.hex[:8]}@hospital.com",
    }

    if "specialization" in doctor_columns:
        doctor_values["specialization"] = "Medicina General"
    if "specialty" in doctor_columns:
        doctor_values["specialty"] = "Medicina General"
    if "license_number" in doctor_columns:
        doctor_values["license_number"] = f"QA-LIC-{doctor_id.hex[:8]}"
    if "phone" in doctor_columns:
        doctor_values["phone"] = f"+349{uuid.uuid4().int % 900000000 + 100000000}"
    if "is_active" in doctor_columns:
        doctor_values["is_active"] = True
    if "created_at" in doctor_columns:
        doctor_values["created_at"] = now
    if "updated_at" in doctor_columns:
        doctor_values["updated_at"] = now

    _insert_dynamic_row(conn, "doctors", doctor_values)

    patient_ids: list[uuid.UUID] = []
    for _ in range(total_patients):
        patient_id = uuid.uuid4()
        patient_ids.append(patient_id)
        patient_values: dict[str, Any] = {
            "id": patient_id,
            "name": f"QA Patient {patient_id.hex[:8]}",
            "email": f"qa.patient.{patient_id.hex[:8]}@mail.com",
        }
        if "phone" in patient_columns:
            patient_values["phone"] = f"+341{uuid.uuid4().int % 900000000 + 100000000}"
        if "created_at" in patient_columns:
            patient_values["created_at"] = now
        if "updated_at" in patient_columns:
            patient_values["updated_at"] = now

        _insert_dynamic_row(conn, "patients", patient_values)

    conn.commit()
    return doctor_id, patient_ids


async def _fire_concurrent_requests(
    api_base_url: str,
    gateway_api_key: str,
    doctor_id: uuid.UUID,
    patient_ids: list[uuid.UUID],
    slot: datetime,
) -> list[int]:
    timeout = httpx.Timeout(timeout=30.0)
    headers = {"X-Internal-Key": gateway_api_key}

    async with httpx.AsyncClient(timeout=timeout) as client:
        async def create_appointment(patient_id: uuid.UUID) -> int:
            payload = {
                "doctor_id": str(doctor_id),
                "patient_id": str(patient_id),
                "date_time": slot.isoformat(),
                "reason": "qa-concurrent-overbooking-test",
                "status": "scheduled",
            }
            response = await client.post(f"{api_base_url}/api/v1/appointments", json=payload, headers=headers)
            return response.status_code

        tasks = [create_appointment(pid) for pid in patient_ids]
        return await asyncio.gather(*tasks)


def _count_persisted_rows(
    conn: psycopg.Connection[Any],
    doctor_id: uuid.UUID,
    slot: datetime,
    slot_column: str,
) -> int:
    with conn.cursor() as cur:
        cur.execute(
            sql.SQL("SELECT COUNT(*) FROM appointments WHERE doctor_id = %s AND {} = %s").format(
                sql.Identifier(slot_column)
            ),
            (doctor_id, slot.replace(tzinfo=None)),
        )
        row = cur.fetchone()
        return int(row[0]) if row else 0


async def run_test() -> int:
    load_dotenv()

    api_base_url = os.getenv("GSENTINEL_API_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
    gateway_api_key = os.getenv("GATEWAY_API_KEY")
    raw_database_url = os.getenv("DATABASE_URL")

    if not gateway_api_key:
        raise RuntimeError("Falta GATEWAY_API_KEY")
    if gateway_api_key in DISALLOWED_KEYS:
        raise RuntimeError("GATEWAY_API_KEY insegura/demo detectada; define una key real")
    if not raw_database_url:
        raise RuntimeError("Falta DATABASE_URL")

    dsn = _database_url_for_psycopg(raw_database_url)
    slot = (datetime.now(timezone.utc) + timedelta(days=1, minutes=5)).replace(microsecond=0)

    with psycopg.connect(dsn, connect_timeout=5, autocommit=False) as conn:
        appointment_time_column = _resolve_appointment_time_column(conn)
        doctor_id, patient_ids = _seed_entities(conn, total_patients=20)

        status_codes = await _fire_concurrent_requests(
            api_base_url=api_base_url,
            gateway_api_key=gateway_api_key,
            doctor_id=doctor_id,
            patient_ids=patient_ids,
            slot=slot,
        )

        success_count = sum(1 for code in status_codes if code == 200)
        conflict_count = sum(1 for code in status_codes if code == 409)
        persisted_rows = _count_persisted_rows(
            conn,
            doctor_id=doctor_id,
            slot=slot,
            slot_column=appointment_time_column,
        )

    print("\n=== QA Concurrent Overbooking Test ===")
    print(f"doctor_id: {doctor_id}")
    print(f"slot: {slot.isoformat()}")
    print(f"status_codes: {status_codes}")
    print(f"success_count(200): {success_count}")
    print(f"conflict_count(409): {conflict_count}")
    print(f"persisted_rows: {persisted_rows}")

    final_query = f"""
SELECT doctor_id, {appointment_time_column}, COUNT(*)
FROM appointments
WHERE doctor_id = '{doctor_id}'
  AND {appointment_time_column} = '{slot.replace(tzinfo=None).isoformat(sep=' ')}'
GROUP BY doctor_id, {appointment_time_column}
HAVING COUNT(*) > 1;
""".strip()
    print("\nQuery de validacion final:")
    print(final_query)

    assert success_count == 1, f"Esperado success_count=1, obtenido {success_count}"
    assert conflict_count == 19, f"Esperado conflict_count=19, obtenido {conflict_count}"
    assert persisted_rows == 1, f"Esperado persisted_rows=1, obtenido {persisted_rows}"

    print("\nRESULTADO: OK - 1 creado, 19 conflictos, 1 fila persistida")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="QA concurrent overbooking test")
    parser.parse_args()
    return asyncio.run(run_test())


if __name__ == "__main__":
    raise SystemExit(main())
