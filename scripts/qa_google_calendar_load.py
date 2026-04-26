#!/usr/bin/env python
"""QA load validation for Google Calendar integration.

Scenario:
- 100 appointments created in parallel
- google_outbox worker running in background

Validations:
1) No duplicates in Google (DB-level always, remote optional)
2) All appointments have google_event_id
3) Outbox rows for create action finish in 'done'
4) System does not collapse (API/worker stability thresholds)

Required env vars:
- QA_INTERNAL_API_KEY (or GATEWAY_API_KEY)
- DATABASE_URL

Optional env vars:
- QA_API_BASE_URL (default: http://localhost:8000/api/v1)
- QA_LOAD_TOTAL (default: 100)
- QA_LOAD_CONCURRENCY (default: 100)
- QA_LOAD_TIMEOUT_SECONDS (default: 240)
- QA_SLOT_SPACING_MINUTES (default: 35)
- QA_SLOT_START_DELAY_MINUTES (default: 30)
- QA_START_OUTBOX_WORKER (default: true)
- QA_WORKER_INTERVAL_SECONDS (default: 1)
- QA_WORKER_BATCH_LIMIT (default: 250)
- QA_GOOGLE_VERIFY (default: false)
- GOOGLE_CALENDAR_ID (default: primary)
- GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 / GOOGLE_SERVICE_ACCOUNT_FILE
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import statistics
import subprocess
import sys
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx
from sqlalchemy import bindparam, create_engine, text


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


def _as_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass
class CreateResult:
    ok: bool
    appointment_id: str | None
    status_code: int
    latency_ms: float
    response_text: str


class GoogleVerifier:
    def __init__(self) -> None:
        self._client = self._build_client()
        self.calendar_id = os.getenv("GOOGLE_CALENDAR_ID", "primary")

    @staticmethod
    def _build_client() -> Any:
        verify = _as_bool(os.getenv("QA_GOOGLE_VERIFY"), default=False)
        if not verify:
            return None

        try:
            from google.oauth2 import service_account  # type: ignore
            from googleapiclient.discovery import build  # type: ignore
        except Exception as exc:
            raise RuntimeError("QA_GOOGLE_VERIFY=true requires google-auth/google-api-python-client") from exc

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

    @property
    def enabled(self) -> bool:
        return self._client is not None

    @staticmethod
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

    @staticmethod
    def _event_signature(event: dict[str, Any]) -> tuple[str, str, str]:
        start_data = event.get("start") or {}
        end_data = event.get("end") or {}
        start_norm = GoogleVerifier._normalize_google_datetime(
            event_time=start_data.get("dateTime"),
            event_date=start_data.get("date"),
        )
        end_norm = GoogleVerifier._normalize_google_datetime(
            event_time=end_data.get("dateTime"),
            event_date=end_data.get("date"),
        )
        summary_norm = str(event.get("summary") or "").strip().lower()
        return (start_norm, end_norm, summary_norm)

    async def count_events_by_appointment(self, appointment_id: str) -> int:
        if not self.enabled:
            return -1

        def _query() -> int:
            data = self._client.events().list(
                calendarId=self.calendar_id,
                privateExtendedProperty=f"appointment_id={appointment_id}",
                maxResults=5,
                singleEvents=True,
                showDeleted=False,
            ).execute()
            return len(data.get("items", []))

        return await asyncio.to_thread(_query)

    async def list_events_in_range(self, *, time_min: datetime, time_max: datetime) -> list[dict[str, Any]]:
        if not self.enabled:
            return []

        min_iso = time_min.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        max_iso = time_max.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

        def _query() -> list[dict[str, Any]]:
            data = self._client.events().list(
                calendarId=self.calendar_id,
                timeMin=min_iso,
                timeMax=max_iso,
                singleEvents=True,
                showDeleted=False,
                maxResults=250,
                orderBy="startTime",
            ).execute()
            return list(data.get("items", []))

        return await asyncio.to_thread(_query)

    async def detect_real_duplicates(
        self,
        appointment_rows: list[dict[str, Any]],
    ) -> dict[str, Any]:
        if not self.enabled or not appointment_rows:
            return {
                "duplicate_groups_count": 0,
                "duplicate_extra_events_count": 0,
                "groups": [],
            }

        grouped: dict[tuple[str, str, str], set[str]] = {}

        for row in appointment_rows:
            start_time = row["start_time"]
            end_time = row["end_time"]
            expected_summary = str(row["summary"] or "").strip().lower()

            # Query in appointment window with narrow tolerance for boundary drift.
            events = await self.list_events_in_range(
                time_min=start_time - timedelta(minutes=1),
                time_max=end_time + timedelta(minutes=1),
            )

            expected_signature = (
                start_time.astimezone(timezone.utc).isoformat(),
                end_time.astimezone(timezone.utc).isoformat(),
                expected_summary,
            )

            matching_ids: set[str] = set()
            for event in events:
                signature = self._event_signature(event)
                if signature == expected_signature:
                    event_id = str(event.get("id") or "").strip()
                    if event_id:
                        matching_ids.add(event_id)

            if len(matching_ids) > 1:
                grouped.setdefault(expected_signature, set()).update(matching_ids)

        groups = []
        duplicate_extra_events_count = 0
        for signature, ids in grouped.items():
            ids_sorted = sorted(ids)
            duplicate_extra_events_count += max(0, len(ids_sorted) - 1)
            groups.append(
                {
                    "start_time": signature[0],
                    "end_time": signature[1],
                    "summary": signature[2],
                    "event_ids": ids_sorted,
                    "events_count": len(ids_sorted),
                }
            )

        return {
            "duplicate_groups_count": len(groups),
            "duplicate_extra_events_count": duplicate_extra_events_count,
            "groups": groups,
        }


def _start_worker_in_background(interval_seconds: int, batch_limit: int) -> subprocess.Popen[str]:
    env = os.environ.copy()
    env["GOOGLE_OUTBOX_SCHEDULER_INTERVAL_SECONDS"] = str(max(1, interval_seconds))
    env["GOOGLE_OUTBOX_PROCESS_LIMIT"] = str(max(1, batch_limit))

    cmd = [sys.executable, str(PROJECT_ROOT / "scripts" / "run_google_outbox_scheduler.py")]
    return subprocess.Popen(
        cmd,
        cwd=str(PROJECT_ROOT),
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        text=True,
    )


def _stop_worker(process: subprocess.Popen[str] | None) -> None:
    if process is None:
        return
    if process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()


async def _create_doctor(client: httpx.AsyncClient, suffix: str) -> str:
    payload = {
        "name": f"QA Load Doctor {suffix}",
        "specialization": "Cardiologia",
        "email": f"qa.load.doctor.{suffix}@example.com",
        "phone": f"+3491{uuid.uuid4().int % 9000000 + 1000000}",
    }
    response = await client.post("/doctors/", json=payload, timeout=30)
    response.raise_for_status()
    return str(response.json()["id"])


async def _create_patient(client: httpx.AsyncClient, suffix: str) -> str:
    payload = {
        "name": f"QA Load Patient {suffix}",
        "phone": f"+346{uuid.uuid4().int % 90000000 + 10000000}",
        "email": f"qa.load.patient.{suffix}@example.com",
    }
    response = await client.post("/patients/", json=payload, timeout=30)
    response.raise_for_status()
    return str(response.json()["id"])


async def _create_one_appointment(
    client: httpx.AsyncClient,
    *,
    internal_key: str,
    doctor_id: str,
    patient_id: str,
    slot_dt: datetime,
    idx: int,
    semaphore: asyncio.Semaphore,
) -> CreateResult:
    payload = {
        "doctor_id": doctor_id,
        "patient_id": patient_id,
        "date_time": slot_dt.isoformat(),
        "reason": f"QA load test {idx}",
        "status": "scheduled",
    }
    headers = {
        "X-Internal-Key": internal_key,
        "Idempotency-Key": f"qa-load-{idx}-{uuid.uuid4().hex}",
    }

    async with semaphore:
        started = time.perf_counter()
        response = await client.post("/appointments", json=payload, headers=headers, timeout=60)
        latency_ms = (time.perf_counter() - started) * 1000.0

    appointment_id = None
    if response.status_code == 200:
        try:
            appointment_id = str(response.json().get("id"))
        except Exception:
            appointment_id = None

    return CreateResult(
        ok=response.status_code == 200 and bool(appointment_id),
        appointment_id=appointment_id,
        status_code=response.status_code,
        latency_ms=latency_ms,
        response_text=response.text[:500],
    )


def _db_snapshot(engine, appointment_ids: list[str]) -> dict[str, Any]:
    if not appointment_ids:
        return {
            "appointments_total": 0,
            "missing_google_event_id": 0,
            "sync_pending": 0,
            "sync_failed": 0,
            "sync_synced": 0,
            "duplicate_google_event_id": 0,
            "outbox_done": 0,
            "outbox_pending_or_processing": 0,
            "outbox_failed": 0,
        }

    ids_param = bindparam("ids", expanding=True)

    q_appointments = text(
        """
        SELECT
            COUNT(*) AS appointments_total,
            SUM(CASE WHEN google_event_id IS NULL THEN 1 ELSE 0 END) AS missing_google_event_id,
            SUM(CASE WHEN google_sync_status = 'pending' THEN 1 ELSE 0 END) AS sync_pending,
            SUM(CASE WHEN google_sync_status = 'failed' THEN 1 ELSE 0 END) AS sync_failed,
            SUM(CASE WHEN google_sync_status = 'synced' THEN 1 ELSE 0 END) AS sync_synced
        FROM appointments
        WHERE id IN :ids
        """
    ).bindparams(ids_param)

    q_duplicates = text(
        """
        SELECT COUNT(*) AS duplicate_groups
        FROM (
            SELECT google_event_id
            FROM appointments
            WHERE id IN :ids AND google_event_id IS NOT NULL
            GROUP BY google_event_id
            HAVING COUNT(*) > 1
        ) dup
        """
    ).bindparams(ids_param)

    q_outbox = text(
        """
        SELECT
            SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done_count,
            SUM(CASE WHEN status IN ('pending','processing') THEN 1 ELSE 0 END) AS pending_or_processing_count,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count
        FROM google_outbox
        WHERE appointment_id IN :ids AND action = 'create'
        """
    ).bindparams(ids_param)

    with engine.begin() as conn:
        row_a = conn.execute(q_appointments, {"ids": appointment_ids}).mappings().first() or {}
        row_d = conn.execute(q_duplicates, {"ids": appointment_ids}).mappings().first() or {}
        row_o = conn.execute(q_outbox, {"ids": appointment_ids}).mappings().first() or {}

    return {
        "appointments_total": int(row_a.get("appointments_total") or 0),
        "missing_google_event_id": int(row_a.get("missing_google_event_id") or 0),
        "sync_pending": int(row_a.get("sync_pending") or 0),
        "sync_failed": int(row_a.get("sync_failed") or 0),
        "sync_synced": int(row_a.get("sync_synced") or 0),
        "duplicate_google_event_id": int(row_d.get("duplicate_groups") or 0),
        "outbox_done": int(row_o.get("done_count") or 0),
        "outbox_pending_or_processing": int(row_o.get("pending_or_processing_count") or 0),
        "outbox_failed": int(row_o.get("failed_count") or 0),
    }


def _load_appointment_windows(engine, appointment_ids: list[str]) -> list[dict[str, Any]]:
    if not appointment_ids:
        return []

    ids_param = bindparam("ids", expanding=True)
    query = text(
        """
        SELECT
            id,
            date_time,
            duration_minutes,
            COALESCE(google_event_id, '') AS google_event_id
        FROM appointments
        WHERE id IN :ids
        """
    ).bindparams(ids_param)

    rows: list[dict[str, Any]] = []
    with engine.begin() as conn:
        for row in conn.execute(query, {"ids": appointment_ids}).mappings().all():
            dt = row["date_time"]
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            duration_raw = str(row.get("duration_minutes") or "30")
            try:
                duration = int(duration_raw)
            except ValueError:
                duration = 30
            rows.append(
                {
                    "appointment_id": str(row["id"]),
                    "google_event_id": str(row.get("google_event_id") or ""),
                    "start_time": dt,
                    "end_time": dt + timedelta(minutes=max(1, duration)),
                    "summary": "turno medico",
                }
            )
    return rows


def _percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    sorted_values = sorted(values)
    index = min(len(sorted_values) - 1, max(0, int(round((p / 100.0) * (len(sorted_values) - 1)))))
    return sorted_values[index]


async def main() -> None:
    api_base = os.getenv("QA_API_BASE_URL", "http://localhost:8000/api/v1").rstrip("/")
    internal_key = _require_env("QA_INTERNAL_API_KEY", os.getenv("GATEWAY_API_KEY"))
    database_url = _normalize_db_url(_require_env("DATABASE_URL"))

    total = int(os.getenv("QA_LOAD_TOTAL", "100"))
    concurrency = int(os.getenv("QA_LOAD_CONCURRENCY", "100"))
    timeout_seconds = int(os.getenv("QA_LOAD_TIMEOUT_SECONDS", "240"))
    spacing_minutes = int(os.getenv("QA_SLOT_SPACING_MINUTES", "35"))
    start_delay_minutes = int(os.getenv("QA_SLOT_START_DELAY_MINUTES", "30"))

    start_worker = _as_bool(os.getenv("QA_START_OUTBOX_WORKER"), default=True)
    worker_interval = int(os.getenv("QA_WORKER_INTERVAL_SECONDS", "1"))
    worker_batch_limit = int(os.getenv("QA_WORKER_BATCH_LIMIT", "250"))

    engine = create_engine(database_url)
    verifier = GoogleVerifier()

    worker_proc: subprocess.Popen[str] | None = None
    suffix = uuid.uuid4().hex[:8]
    began = time.perf_counter()

    try:
        if start_worker:
            worker_proc = _start_worker_in_background(worker_interval, worker_batch_limit)

        async with httpx.AsyncClient(base_url=api_base) as client:
            doctor_id = await _create_doctor(client, suffix)
            patient_id = await _create_patient(client, suffix)

            base_dt = datetime.now(timezone.utc) + timedelta(minutes=start_delay_minutes)
            semaphore = asyncio.Semaphore(max(1, concurrency))

            tasks = []
            for idx in range(total):
                slot_dt = base_dt + timedelta(minutes=idx * spacing_minutes)
                tasks.append(
                    _create_one_appointment(
                        client,
                        internal_key=internal_key,
                        doctor_id=doctor_id,
                        patient_id=patient_id,
                        slot_dt=slot_dt,
                        idx=idx,
                        semaphore=semaphore,
                    )
                )

            create_results = await asyncio.gather(*tasks)

        ok_results = [item for item in create_results if item.ok and item.appointment_id]
        appointment_ids = [str(item.appointment_id) for item in ok_results if item.appointment_id]

        create_latencies = [item.latency_ms for item in create_results]
        create_success = len(ok_results)
        create_fail = len(create_results) - create_success
        create_success_rate = (create_success / total) if total > 0 else 0.0
        api_5xx = sum(1 for item in create_results if item.status_code >= 500)

        deadline = time.perf_counter() + timeout_seconds
        snapshot = _db_snapshot(engine, appointment_ids)
        while time.perf_counter() < deadline:
            snapshot = _db_snapshot(engine, appointment_ids)
            done_condition = (
                snapshot["appointments_total"] == len(appointment_ids)
                and snapshot["missing_google_event_id"] == 0
                and snapshot["outbox_done"] == len(appointment_ids)
                and snapshot["outbox_pending_or_processing"] == 0
                and snapshot["outbox_failed"] == 0
            )
            if done_condition:
                break
            await asyncio.sleep(2)

        remote_duplicates = 0
        remote_missing = 0
        remote_checked = 0
        real_duplicate_groups_count = 0
        real_duplicate_extra_events_count = 0
        real_duplicate_groups: list[dict[str, Any]] = []
        if verifier.enabled:
            async def _check_remote(appointment_id: str) -> tuple[int, int]:
                count = await verifier.count_events_by_appointment(appointment_id)
                if count == 0:
                    return (0, 1)
                if count > 1:
                    return (1, 0)
                return (0, 0)

            checks = await asyncio.gather(*[_check_remote(item_id) for item_id in appointment_ids])
            remote_duplicates = sum(item[0] for item in checks)
            remote_missing = sum(item[1] for item in checks)
            remote_checked = len(checks)

            appointment_windows = _load_appointment_windows(engine, appointment_ids)
            real_dup_result = await verifier.detect_real_duplicates(appointment_windows)
            real_duplicate_groups_count = int(real_dup_result.get("duplicate_groups_count") or 0)
            real_duplicate_extra_events_count = int(real_dup_result.get("duplicate_extra_events_count") or 0)
            real_duplicate_groups = list(real_dup_result.get("groups") or [])

        total_duration_seconds = time.perf_counter() - began
        p95_latency_ms = _percentile(create_latencies, 95)

        pass_no_duplicates = (
            snapshot["duplicate_google_event_id"] == 0
            and (remote_duplicates == 0)
            and (real_duplicate_groups_count == 0)
        )
        pass_all_have_google_event_id = snapshot["missing_google_event_id"] == 0 and snapshot["appointments_total"] == len(appointment_ids)
        pass_outbox_done = (
            snapshot["outbox_done"] == len(appointment_ids)
            and snapshot["outbox_pending_or_processing"] == 0
            and snapshot["outbox_failed"] == 0
        )
        pass_system_stable = (
            create_success == total
            and api_5xx == 0
            and p95_latency_ms < 4000
            and total_duration_seconds <= (timeout_seconds + 10)
        )

        passed = pass_no_duplicates and pass_all_have_google_event_id and pass_outbox_done and pass_system_stable

        report = {
            "scenario": {
                "appointments_requested": total,
                "parallel_concurrency": concurrency,
                "worker_background": start_worker,
                "worker_interval_seconds": worker_interval,
                "worker_batch_limit": worker_batch_limit,
                "google_remote_verification": verifier.enabled,
            },
            "metrics": {
                "create_success": create_success,
                "create_fail": create_fail,
                "create_success_rate": round(create_success_rate, 4),
                "api_5xx_count": api_5xx,
                "latency_avg_ms": round(statistics.mean(create_latencies), 2) if create_latencies else 0.0,
                "latency_p95_ms": round(p95_latency_ms, 2),
                "duration_total_seconds": round(total_duration_seconds, 2),
                "appointments_total_in_db": snapshot["appointments_total"],
                "appointments_missing_google_event_id": snapshot["missing_google_event_id"],
                "appointments_sync_synced": snapshot["sync_synced"],
                "appointments_sync_pending": snapshot["sync_pending"],
                "appointments_sync_failed": snapshot["sync_failed"],
                "db_duplicate_google_event_id_groups": snapshot["duplicate_google_event_id"],
                "outbox_done": snapshot["outbox_done"],
                "outbox_pending_or_processing": snapshot["outbox_pending_or_processing"],
                "outbox_failed": snapshot["outbox_failed"],
                "remote_checked": remote_checked,
                "remote_duplicate_events": remote_duplicates,
                "remote_missing_events": remote_missing,
                "google_real_duplicate_groups_count": real_duplicate_groups_count,
                "google_real_duplicate_extra_events_count": real_duplicate_extra_events_count,
                "google_real_duplicate_groups": real_duplicate_groups,
            },
            "pass_fail": {
                "no_duplicates_in_google": pass_no_duplicates,
                "all_appointments_have_google_event_id": pass_all_have_google_event_id,
                "outbox_all_done": pass_outbox_done,
                "system_not_collapsed": pass_system_stable,
                "overall": passed,
            },
            "thresholds": {
                "create_success_must_equal_requested": True,
                "api_5xx_must_be_zero": True,
                "latency_p95_ms_lt": 4000,
                "missing_google_event_id_must_be_zero": True,
                "outbox_failed_must_be_zero": True,
                "outbox_pending_or_processing_must_be_zero": True,
                "duplicate_google_event_id_must_be_zero": True,
                "remote_duplicate_events_must_be_zero_if_enabled": True,
                "real_duplicate_groups_must_be_zero_if_enabled": True,
            },
        }

        print(json.dumps(report, indent=2, ensure_ascii=True))
        if not passed:
            raise SystemExit(1)

    finally:
        _stop_worker(worker_proc)


if __name__ == "__main__":
    asyncio.run(main())
