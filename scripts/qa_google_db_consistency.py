#!/usr/bin/env python
"""QA consistency validation between DB appointments and Google Calendar.

Validation scope:
1) For every appointment with google_event_id, query Google API and verify event exists.
2) Validate start/end consistency against DB appointment window.
3) Validate Google event is not cancelled.

Outputs:
- Structured JSON report with additional metrics.
- Missing events list and inconsistency list with involved IDs.

Required env vars:
- DATABASE_URL

Optional env vars:
- GOOGLE_CALENDAR_ID (default: primary)
- GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 / GOOGLE_SERVICE_ACCOUNT_FILE
- QA_CONSISTENCY_HOURS (default: 72)
- QA_CONSISTENCY_LIMIT (default: 2000)
- QA_CONSISTENCY_CONCURRENCY (default: 20)
- QA_CONSISTENCY_DETAILS_LIMIT (default: 300)
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import bindparam, create_engine, text


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def _normalize_db_url(url: str) -> str:
    value = url.strip()
    if value.startswith("postgresql+asyncpg://"):
        return value.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
    if value.startswith("sqlite+aiosqlite://"):
        return value.replace("sqlite+aiosqlite://", "sqlite://", 1)
    return value


def _require_env(name: str) -> str:
    value = (os.getenv(name) or "").strip()
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


def _to_utc_iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


def _normalize_google_datetime(event_time: str | None, event_date: str | None) -> str:
    if event_time:
        value = event_time.strip()
        if value.endswith("Z"):
            value = value[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(value)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc).isoformat()
        except ValueError:
            return value

    if event_date:
        try:
            dt = datetime.fromisoformat(event_date).replace(tzinfo=timezone.utc)
            return dt.isoformat()
        except ValueError:
            return event_date

    return ""


@dataclass
class AppointmentRecord:
    appointment_id: str
    google_event_id: str
    status: str
    expected_start: str
    expected_end: str


class GoogleClient:
    def __init__(self) -> None:
        self.calendar_id = os.getenv("GOOGLE_CALENDAR_ID", "primary")
        self._client = self._build_client()

    @staticmethod
    def _build_client() -> Any:
        try:
            from google.oauth2 import service_account  # type: ignore
            from googleapiclient.discovery import build  # type: ignore
        except Exception as exc:
            raise RuntimeError("Missing google-auth/google-api-python-client") from exc

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
                "Set GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 or GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_FILE"
            )

        creds = service_account.Credentials.from_service_account_info(
            info,
            scopes=["https://www.googleapis.com/auth/calendar.events"],
        )
        return build("calendar", "v3", credentials=creds, cache_discovery=False)

    async def get_event(self, event_id: str) -> tuple[dict[str, Any] | None, str | None]:
        def _call() -> tuple[dict[str, Any] | None, str | None]:
            try:
                event = self._client.events().get(calendarId=self.calendar_id, eventId=event_id).execute()
                return event, None
            except Exception as exc:
                status_code = None
                resp = getattr(exc, "resp", None)
                if resp is not None:
                    status_code = getattr(resp, "status", None)

                if status_code == 404:
                    return None, "not_found"
                return None, f"google_error:{type(exc).__name__}:{status_code or 'unknown'}"

        return await asyncio.to_thread(_call)


def _load_appointments(engine, hours: int, limit: int) -> list[AppointmentRecord]:
    cutoff = datetime.utcnow() - timedelta(hours=max(1, hours))

    query = text(
        """
        SELECT
            id,
            google_event_id,
            status,
            date_time,
            duration_minutes
        FROM appointments
        WHERE google_event_id IS NOT NULL
          AND updated_at >= :cutoff
        ORDER BY updated_at DESC
        LIMIT :limit
        """
    )

    records: list[AppointmentRecord] = []
    with engine.begin() as conn:
        rows = conn.execute(query, {"cutoff": cutoff, "limit": max(1, limit)}).mappings().all()

    for row in rows:
        dt = row["date_time"]
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        duration_raw = str(row.get("duration_minutes") or "30")
        try:
            duration_mins = int(duration_raw)
        except ValueError:
            duration_mins = 30

        expected_start = _to_utc_iso(dt)
        expected_end = _to_utc_iso(dt + timedelta(minutes=max(1, duration_mins)))

        records.append(
            AppointmentRecord(
                appointment_id=str(row["id"]),
                google_event_id=str(row["google_event_id"]),
                status=str(row.get("status") or ""),
                expected_start=expected_start,
                expected_end=expected_end,
            )
        )

    return records


async def _validate_one(
    record: AppointmentRecord,
    google: GoogleClient,
    semaphore: asyncio.Semaphore,
) -> dict[str, Any]:
    async with semaphore:
        event, error = await google.get_event(record.google_event_id)

    if error == "not_found":
        return {
            "appointment_id": record.appointment_id,
            "google_event_id": record.google_event_id,
            "state": "missing",
            "error": "not_found",
            "issues": ["missing_event"],
        }

    if error is not None:
        return {
            "appointment_id": record.appointment_id,
            "google_event_id": record.google_event_id,
            "state": "error",
            "error": error,
            "issues": ["google_api_error"],
        }

    assert event is not None
    start_data = event.get("start") or {}
    end_data = event.get("end") or {}
    actual_start = _normalize_google_datetime(start_data.get("dateTime"), start_data.get("date"))
    actual_end = _normalize_google_datetime(end_data.get("dateTime"), end_data.get("date"))
    actual_status = str(event.get("status") or "")

    issues: list[str] = []
    if actual_start != record.expected_start:
        issues.append("start_mismatch")
    if actual_end != record.expected_end:
        issues.append("end_mismatch")
    if actual_status.lower() == "cancelled":
        issues.append("remote_cancelled")

    if not issues:
        return {
            "appointment_id": record.appointment_id,
            "google_event_id": record.google_event_id,
            "state": "consistent",
            "issues": [],
        }

    return {
        "appointment_id": record.appointment_id,
        "google_event_id": record.google_event_id,
        "state": "inconsistent",
        "issues": issues,
        "expected": {
            "start": record.expected_start,
            "end": record.expected_end,
            "db_status": record.status,
        },
        "actual": {
            "start": actual_start,
            "end": actual_end,
            "google_status": actual_status,
        },
    }


async def main() -> None:
    database_url = _normalize_db_url(_require_env("DATABASE_URL"))
    hours = int(os.getenv("QA_CONSISTENCY_HOURS", "72"))
    limit = int(os.getenv("QA_CONSISTENCY_LIMIT", "2000"))
    concurrency = int(os.getenv("QA_CONSISTENCY_CONCURRENCY", "20"))
    details_limit = int(os.getenv("QA_CONSISTENCY_DETAILS_LIMIT", "300"))

    started = time.perf_counter()
    engine = create_engine(database_url)
    google = GoogleClient()

    records = _load_appointments(engine, hours=max(1, hours), limit=max(1, limit))
    semaphore = asyncio.Semaphore(max(1, concurrency))

    tasks = [_validate_one(rec, google, semaphore) for rec in records]
    results = await asyncio.gather(*tasks)

    missing = [r for r in results if r["state"] == "missing"]
    api_errors = [r for r in results if r["state"] == "error"]
    inconsistent = [r for r in results if r["state"] == "inconsistent"]
    consistent = [r for r in results if r["state"] == "consistent"]

    start_mismatch_count = sum(1 for r in inconsistent if "start_mismatch" in r.get("issues", []))
    end_mismatch_count = sum(1 for r in inconsistent if "end_mismatch" in r.get("issues", []))
    remote_cancelled_count = sum(1 for r in inconsistent if "remote_cancelled" in r.get("issues", []))

    report = {
        "scope": {
            "hours": max(1, hours),
            "limit": max(1, limit),
            "concurrency": max(1, concurrency),
            "calendar_id": google.calendar_id,
        },
        "metrics": {
            "appointments_scanned": len(records),
            "consistent_count": len(consistent),
            "missing_events_count": len(missing),
            "google_api_errors_count": len(api_errors),
            "inconsistent_count": len(inconsistent),
            "start_mismatch_count": start_mismatch_count,
            "end_mismatch_count": end_mismatch_count,
            "remote_cancelled_count": remote_cancelled_count,
            "duration_seconds": round(time.perf_counter() - started, 3),
        },
        "missing_events": missing[: max(1, details_limit)],
        "inconsistencies": inconsistent[: max(1, details_limit)],
        "google_api_errors": api_errors[: max(1, details_limit)],
        "pass_fail": {
            "missing_events_is_zero": len(missing) == 0,
            "inconsistencies_is_zero": len(inconsistent) == 0,
            "google_api_errors_is_zero": len(api_errors) == 0,
            "overall": (len(missing) == 0 and len(inconsistent) == 0 and len(api_errors) == 0),
        },
    }

    print(json.dumps(report, indent=2, ensure_ascii=True))
    if not report["pass_fail"]["overall"]:
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
