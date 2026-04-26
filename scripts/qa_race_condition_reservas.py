"""QA concurrency test para detectar race condition en reservas.

Escenario por defecto:
- 10 requests simultaneos
- mismo doctor_id + mismo slot (date_time)
- pacientes distintos

Criterio correcto:
- solo 1 reserva creada
- 9 respuestas en conflicto (409)
- 1 sola fila en DB para ese slot
"""

from __future__ import annotations

import argparse
import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
import psycopg
from dotenv import load_dotenv
from psycopg import sql


DISALLOWED_KEYS = {"gateway-secret-key-change-production", "change-me-gateway-key"}


def _to_psycopg_dsn(database_url: str) -> str:
    if database_url.startswith("postgresql+psycopg://"):
        return database_url.replace("postgresql+psycopg://", "postgresql://", 1)
    if database_url.startswith("postgresql://"):
        return database_url
    raise RuntimeError("DATABASE_URL debe apuntar a PostgreSQL")


def _table_columns(conn: psycopg.Connection[Any], table_name: str) -> set[str]:
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


def _insert_row(conn: psycopg.Connection[Any], table_name: str, values: dict[str, Any]) -> None:
    keys = list(values.keys())
    query = sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
        sql.Identifier(table_name),
        sql.SQL(", ").join(sql.Identifier(k) for k in keys),
        sql.SQL(", ").join(sql.Placeholder() for _ in keys),
    )
    with conn.cursor() as cur:
        cur.execute(query, [values[k] for k in keys])


def _resolve_slot_column(conn: psycopg.Connection[Any]) -> str:
    cols = _table_columns(conn, "appointments")
    for candidate in ("date_time", "datetime", "appointment_date"):
        if candidate in cols:
            return candidate
    raise RuntimeError("appointments no tiene date_time/datetime/appointment_date")


def _seed_doctor_and_patients(conn: psycopg.Connection[Any], n: int) -> tuple[uuid.UUID, list[uuid.UUID]]:
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    doctor_cols = _table_columns(conn, "doctors")
    patient_cols = _table_columns(conn, "patients")

    doctor_id = uuid.uuid4()
    doctor_values: dict[str, Any] = {
        "id": doctor_id,
        "name": f"QA Doctor {doctor_id.hex[:8]}",
        "email": f"qa.doctor.{doctor_id.hex[:8]}@hospital.com",
    }
    if "specialization" in doctor_cols:
        doctor_values["specialization"] = "Medicina General"
    if "specialty" in doctor_cols:
        doctor_values["specialty"] = "Medicina General"
    if "license_number" in doctor_cols:
        doctor_values["license_number"] = f"QA-LIC-{doctor_id.hex[:8]}"
    if "phone" in doctor_cols:
        doctor_values["phone"] = f"+349{uuid.uuid4().int % 900000000 + 100000000}"
    if "is_active" in doctor_cols:
        doctor_values["is_active"] = True
    if "created_at" in doctor_cols:
        doctor_values["created_at"] = now
    if "updated_at" in doctor_cols:
        doctor_values["updated_at"] = now
    _insert_row(conn, "doctors", doctor_values)

    patient_ids: list[uuid.UUID] = []
    for _ in range(n):
        patient_id = uuid.uuid4()
        patient_ids.append(patient_id)
        patient_values: dict[str, Any] = {
            "id": patient_id,
            "name": f"QA Patient {patient_id.hex[:8]}",
            "email": f"qa.patient.{patient_id.hex[:8]}@mail.com",
        }
        if "phone" in patient_cols:
            patient_values["phone"] = f"+341{uuid.uuid4().int % 900000000 + 100000000}"
        if "created_at" in patient_cols:
            patient_values["created_at"] = now
        if "updated_at" in patient_cols:
            patient_values["updated_at"] = now
        _insert_row(conn, "patients", patient_values)

    conn.commit()
    return doctor_id, patient_ids


async def _run_concurrent_calls(
    api_base_url: str,
    gateway_api_key: str,
    doctor_id: uuid.UUID,
    patient_ids: list[uuid.UUID],
    slot: datetime,
) -> list[int]:
    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
        async def create_one(patient_id: uuid.UUID) -> int:
            payload = {
                "doctor_id": str(doctor_id),
                "patient_id": str(patient_id),
                "date_time": slot.isoformat(),
                "reason": "qa-race-condition-test",
                "status": "scheduled",
            }
            headers = {
                "X-Internal-Key": gateway_api_key,
                "Idempotency-Key": f"race-{uuid.uuid4()}",
            }
            resp = await client.post(f"{api_base_url}/api/v1/appointments", json=payload, headers=headers)
            return resp.status_code

        tasks = [create_one(pid) for pid in patient_ids]
        return await asyncio.gather(*tasks)


def _count_rows_for_slot(
    conn: psycopg.Connection[Any],
    doctor_id: uuid.UUID,
    slot: datetime,
    slot_col: str,
) -> int:
    with conn.cursor() as cur:
        cur.execute(
            sql.SQL("SELECT COUNT(*) FROM appointments WHERE doctor_id = %s AND {} = %s").format(sql.Identifier(slot_col)),
            (doctor_id, slot.replace(tzinfo=None)),
        )
        row = cur.fetchone()
        return int(row[0]) if row else 0


async def main_async(concurrency: int) -> int:
    load_dotenv()

    api_base_url = os.getenv("GSENTINEL_API_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
    gateway_api_key = os.getenv("GATEWAY_API_KEY")
    raw_db_url = os.getenv("DATABASE_URL")

    if not gateway_api_key:
        raise RuntimeError("Falta GATEWAY_API_KEY")
    if gateway_api_key in DISALLOWED_KEYS:
        raise RuntimeError("GATEWAY_API_KEY insegura/demo detectada")
    if not raw_db_url:
        raise RuntimeError("Falta DATABASE_URL")

    dsn = _to_psycopg_dsn(raw_db_url)
    slot = (datetime.now(timezone.utc) + timedelta(days=1, minutes=3)).replace(microsecond=0)

    with psycopg.connect(dsn, connect_timeout=5, autocommit=False) as conn:
        slot_col = _resolve_slot_column(conn)
        doctor_id, patient_ids = _seed_doctor_and_patients(conn, concurrency)

        status_codes = await _run_concurrent_calls(
            api_base_url=api_base_url,
            gateway_api_key=gateway_api_key,
            doctor_id=doctor_id,
            patient_ids=patient_ids,
            slot=slot,
        )

        success_count = sum(1 for c in status_codes if c in {200, 201})
        conflict_count = sum(1 for c in status_codes if c == 409)
        rows_count = _count_rows_for_slot(conn, doctor_id, slot, slot_col)

    print("\n=== QA Race Condition Report ===")
    print(f"concurrency: {concurrency}")
    print(f"doctor_id: {doctor_id}")
    print(f"slot: {slot.isoformat()}")
    print(f"status_codes: {status_codes}")
    print(f"success_count: {success_count}")
    print(f"conflict_count: {conflict_count}")
    print(f"rows_in_db_for_slot: {rows_count}")

    print("\nQuery validacion:")
    print(
        f"SELECT doctor_id, {slot_col}, COUNT(*) "
        f"FROM appointments "
        f"WHERE doctor_id = '{doctor_id}' AND {slot_col} = '{slot.replace(tzinfo=None).isoformat(sep=' ')}' "
        f"GROUP BY doctor_id, {slot_col};"
    )

    assert success_count == 1, f"FALLO: se esperaba 1 exito, obtenido {success_count}"
    assert conflict_count == concurrency - 1, (
        f"FALLO: se esperaban {concurrency - 1} conflictos 409, obtenido {conflict_count}"
    )
    assert rows_count == 1, f"FALLO: se esperaba 1 fila en DB, obtenido {rows_count}"

    print("\nRESULTADO CORRECTO: 1 turno creado y el resto rechazado por conflicto")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Detectar race condition en reservas concurrentes")
    parser.add_argument("--concurrency", type=int, default=10, help="Cantidad de requests simultaneos")
    args = parser.parse_args()
    return asyncio.run(main_async(args.concurrency))


if __name__ == "__main__":
    raise SystemExit(main())
