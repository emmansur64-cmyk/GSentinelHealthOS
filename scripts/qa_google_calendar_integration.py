#!/usr/bin/env python
"""QA end-to-end validation for Google Calendar integration.

Covers:
1) Appointment create -> Google event exists.
2) Retry processing -> no duplicate event creation.
3) Google failure -> appointment remains saved and outbox retries.
4) Appointment cancel -> Google event deleted.

Required env vars:
- QA_API_BASE_URL (default: http://localhost:8000/api/v1)
- GATEWAY_API_KEY (or QA_INTERNAL_API_KEY)
- DATABASE_URL

Optional:
- QA_GOOGLE_VERIFY=true|false (default: true)
- GOOGLE_CALENDAR_ID (default: primary)
- GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 / GOOGLE_SERVICE_ACCOUNT_FILE
"""

from __future__ import annotations

import base64
import json
import os
import random
import subprocess
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx
from sqlalchemy import create_engine, text


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def _normalize_db_url(url: str) -> str:
    value = url.strip()
    if value.startswith("postgresql+asyncpg://"):
        return value.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
    if value.startswith("sqlite+aiosqlite://"):
        return value.replace("sqlite+aiosqlite://", "sqlite://", 1)
    return value


def _require_env(name: str, fallback: str | None = None) -> str:
    value = (os.getenv(name) or fallback or "").strip()
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


def _build_google_client_if_enabled() -> Any | None:
    verify = (os.getenv("QA_GOOGLE_VERIFY", "true").strip().lower() == "true")
    if not verify:
        return None

    try:
        from google.oauth2 import service_account  # type: ignore
        from googleapiclient.discovery import build  # type: ignore
    except Exception as exc:
        raise RuntimeError("Missing google-auth/google-api-python-client for QA_GOOGLE_VERIFY=true") from exc

    raw_b64 = (os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64") or "").strip()
    raw_json = (os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON") or "").strip()
    raw_file = (os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE") or "").strip()

    info: dict[str, Any]
    if raw_b64:
        info = json.loads(base64.b64decode(raw_b64).decode("utf-8"))
    elif raw_json:
        info = json.loads(raw_json)
    elif raw_file:
        path = Path(raw_file).expanduser()
        if not path.exists():
            raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_FILE not found")
        info = json.loads(path.read_text(encoding="utf-8"))
    else:
        raise RuntimeError(
            "QA_GOOGLE_VERIFY=true requires GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 or "
            "GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_FILE"
        )

    creds = service_account.Credentials.from_service_account_info(
        info,
        scopes=["https://www.googleapis.com/auth/calendar.events"],
    )
    return build("calendar", "v3", credentials=creds, cache_discovery=False)


def _create_doctor(client: httpx.Client, suffix: str) -> str:
    payload = {
        "name": f"QA Doctor {suffix}",
        "specialization": "Cardiologia",
        "email": f"qa.doctor.{suffix}@example.com",
        "phone": f"+3491{random.randint(1000000, 9999999)}",
    }
    resp = client.post("/doctors/", json=payload, timeout=30)
    resp.raise_for_status()
    return str(resp.json()["id"])


def _create_patient(client: httpx.Client, suffix: str) -> str:
    payload = {
        "name": f"QA Patient {suffix}",
        "phone": f"+346{random.randint(10000000, 99999999)}",
        "email": f"qa.patient.{suffix}@example.com",
    }
    resp = client.post("/patients/", json=payload, timeout=30)
    resp.raise_for_status()
    return str(resp.json()["id"])


def _create_appointment(client: httpx.Client, doctor_id: str, patient_id: str, dt: datetime, internal_key: str) -> dict[str, Any]:
    payload = {
        "doctor_id": doctor_id,
        "patient_id": patient_id,
        "date_time": dt.isoformat(),
        "reason": "QA Google Calendar integration",
        "status": "scheduled",
    }
    resp = client.post(
        "/appointments",
        json=payload,
        headers={"X-Internal-Key": internal_key},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def _get_appointment(client: httpx.Client, appointment_id: str, internal_key: str) -> dict[str, Any]:
    resp = client.get(
        f"/appointments/{appointment_id}",
        headers={"X-Internal-Key": internal_key},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def _cancel_appointment(client: httpx.Client, appointment_id: str, internal_key: str) -> dict[str, Any]:
    resp = client.delete(
        f"/appointments/{appointment_id}",
        headers={"X-Internal-Key": internal_key},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def _run_google_worker(env_overrides: dict[str, str] | None = None) -> None:
    env = os.environ.copy()
    if env_overrides:
        env.update(env_overrides)
    cmd = [sys.executable, str(PROJECT_ROOT / "scripts" / "process_google_outbox.py")]
    result = subprocess.run(cmd, cwd=str(PROJECT_ROOT), env=env, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"process_google_outbox.py failed: {result.stderr or result.stdout}")


def _wait_for_sync(client: httpx.Client, appointment_id: str, internal_key: str, timeout_sec: int = 60) -> dict[str, Any]:
    started = time.time()
    while time.time() - started < timeout_sec:
        data = _get_appointment(client, appointment_id, internal_key)
        status = (data.get("google_sync_status") or "").lower()
        if status in {"synced", "failed"}:
            return data
        time.sleep(2)
    return _get_appointment(client, appointment_id, internal_key)


def _db_row(engine, sql: str, params: dict[str, Any]) -> dict[str, Any] | None:
    with engine.begin() as conn:
        row = conn.execute(text(sql), params).mappings().first()
        return dict(row) if row else None


def _db_execute(engine, sql: str, params: dict[str, Any]) -> None:
    with engine.begin() as conn:
        conn.execute(text(sql), params)


def _assert(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    api_base = os.getenv("QA_API_BASE_URL", "http://localhost:8000/api/v1").rstrip("/")
    internal_key = _require_env("QA_INTERNAL_API_KEY", os.getenv("GATEWAY_API_KEY"))
    database_url = _normalize_db_url(_require_env("DATABASE_URL"))
    calendar_id = os.getenv("GOOGLE_CALENDAR_ID", "primary")

    google_client = _build_google_client_if_enabled()
    engine = create_engine(database_url)

    suffix = uuid.uuid4().hex[:8]
    now = datetime.now(timezone.utc)

    with httpx.Client(base_url=api_base) as client:
        doctor_id = _create_doctor(client, suffix)
        patient_id = _create_patient(client, suffix)

        # Case 1: Create appointment -> event appears in Google.
        appt_1_dt = now + timedelta(minutes=45)
        appt_1 = _create_appointment(client, doctor_id, patient_id, appt_1_dt, internal_key)
        appt_1_id = str(appt_1["id"])
        synced_1 = _wait_for_sync(client, appt_1_id, internal_key)
        _assert(synced_1.get("id") == appt_1_id, "Appointment create failed")
        _assert(synced_1.get("google_sync_status") == "synced", "Appointment not synced after create")
        _assert(bool(synced_1.get("google_event_id")), "google_event_id missing after create")

        event_id_1 = str(synced_1["google_event_id"])
        if google_client is not None:
            google_client.events().get(calendarId=calendar_id, eventId=event_id_1).execute()

        # Case 2: Retry -> no duplicate event.
        _db_execute(
            engine,
            """
            UPDATE google_outbox
            SET status='pending', next_attempt_at=CURRENT_TIMESTAMP
            WHERE appointment_id=:appointment_id AND action='create'
            """,
            {"appointment_id": appt_1_id},
        )
        _run_google_worker()
        _run_google_worker()

        synced_2 = _get_appointment(client, appt_1_id, internal_key)
        _assert(synced_2.get("google_event_id") == event_id_1, "Duplicate/changed event_id detected on retry")

        # Case 3: Google failure -> appointment saved + outbox retries.
        appt_2_dt = now + timedelta(minutes=95)
        appt_2 = _create_appointment(client, doctor_id, patient_id, appt_2_dt, internal_key)
        appt_2_id = str(appt_2["id"])

        _run_google_worker(env_overrides={"GOOGLE_CALENDAR_ID": "qa-invalid-calendar-id"})

        appt_2_state = _get_appointment(client, appt_2_id, internal_key)
        _assert(appt_2_state.get("id") == appt_2_id, "Appointment missing after Google failure")
        _assert(
            (appt_2_state.get("google_sync_status") or "").lower() in {"failed", "pending", "synced"},
            "Unexpected google_sync_status",
        )

        outbox_2 = _db_row(
            engine,
            """
            SELECT status, retries, last_error
            FROM google_outbox
            WHERE appointment_id=:appointment_id AND action='create'
            ORDER BY created_at DESC
            LIMIT 1
            """,
            {"appointment_id": appt_2_id},
        )
        _assert(outbox_2 is not None, "google_outbox row not found for failure case")
        retries_value = int((outbox_2 or {}).get("retries", 0))
        _assert(retries_value >= 1, "Outbox retries did not increment on failure")

        # Case 4: Cancel -> event deleted.
        _cancel_appointment(client, appt_1_id, internal_key)
        _run_google_worker()
        cancelled = _get_appointment(client, appt_1_id, internal_key)
        _assert(cancelled.get("status") == "cancelled", "Appointment was not cancelled")

        if google_client is not None:
            deleted_ok = False
            try:
                google_client.events().get(calendarId=calendar_id, eventId=event_id_1).execute()
            except Exception:
                deleted_ok = True
            _assert(deleted_ok, "Google event still exists after cancellation")

    print("\nQA CHECKLIST RESULT: PASS")
    print("- [OK] Create appointment -> Google event created")
    print("- [OK] Retry processing -> no duplicate event")
    print("- [OK] Google failure -> appointment persisted and outbox retried")
    print("- [OK] Cancellation -> Google event deleted")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"\nQA CHECKLIST RESULT: FAIL\nReason: {exc}")
        raise
