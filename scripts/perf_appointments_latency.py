#!/usr/bin/env python
"""Performance profiling for appointment system latency.

Measures and separates:
1) API latency: POST /appointments roundtrip
2) DB latency: direct SELECTs over appointments/google_outbox
3) Google async latency: google_outbox create flow time (created_at -> processed_at)

Outputs p50/p95/p99 and bottleneck analysis with optimization recommendations.

Required env vars:
- DATABASE_URL
- PERF_INTERNAL_API_KEY or GATEWAY_API_KEY

Optional env vars:
- PERF_API_BASE_URL (default: http://localhost:8000/api/v1)
- PERF_TOTAL (default: 120)
- PERF_CONCURRENCY (default: 24)
- PERF_SLOT_SPACING_MINUTES (default: 35)
- PERF_SLOT_START_DELAY_MINUTES (default: 20)
- PERF_TIMEOUT_SECONDS (default: 300)
- PERF_START_GOOGLE_WORKER (default: true)
- PERF_GOOGLE_WORKER_INTERVAL_SECONDS (default: 1)
- PERF_GOOGLE_WORKER_BATCH_LIMIT (default: 250)
- PERF_DB_SAMPLES_PER_APPOINTMENT (default: 2)
"""

from __future__ import annotations

import asyncio
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


def _require_env(name: str, fallback: str | None = None) -> str:
    value = (os.getenv(name) or fallback or "").strip()
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


def _as_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _normalize_db_url(url: str) -> str:
    value = url.strip()
    if value.startswith("postgresql+asyncpg://"):
        return value.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
    if value.startswith("sqlite+aiosqlite://"):
        return value.replace("sqlite+aiosqlite://", "sqlite://", 1)
    return value


def _percentile(values: list[float], percentile: float) -> float:
    if not values:
        return 0.0
    sorted_values = sorted(values)
    index = int(round((percentile / 100.0) * (len(sorted_values) - 1)))
    index = max(0, min(index, len(sorted_values) - 1))
    return sorted_values[index]


def _stats(values_ms: list[float]) -> dict[str, float]:
    if not values_ms:
        return {"count": 0.0, "avg_ms": 0.0, "p50_ms": 0.0, "p95_ms": 0.0, "p99_ms": 0.0, "max_ms": 0.0}
    return {
        "count": float(len(values_ms)),
        "avg_ms": round(statistics.mean(values_ms), 3),
        "p50_ms": round(_percentile(values_ms, 50), 3),
        "p95_ms": round(_percentile(values_ms, 95), 3),
        "p99_ms": round(_percentile(values_ms, 99), 3),
        "max_ms": round(max(values_ms), 3),
    }


def _start_google_worker(interval_seconds: int, batch_limit: int) -> subprocess.Popen[str]:
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


def _stop_process(proc: subprocess.Popen[str] | None) -> None:
    if proc is None:
        return
    if proc.poll() is not None:
        return
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()


@dataclass
class ApiCreateResult:
    ok: bool
    appointment_id: str | None
    status_code: int
    latency_ms: float


async def _create_doctor(client: httpx.AsyncClient, suffix: str) -> str:
    payload = {
        "name": f"PERF Doctor {suffix}",
        "specialty": "Cardiologia",
        "email": f"perf.doctor.{suffix}@example.com",
        "phone": f"+3491{uuid.uuid4().int % 9000000 + 1000000}",
        "license_number": f"PERF-{suffix}",
        "is_active": True,
    }
    resp = await client.post("/doctors/", json=payload, timeout=30)
    resp.raise_for_status()
    return str(resp.json()["id"])


async def _create_patient(client: httpx.AsyncClient, suffix: str) -> str:
    payload = {
        "name": f"PERF Patient {suffix}",
        "phone": f"+346{uuid.uuid4().int % 90000000 + 10000000}",
        "email": f"perf.patient.{suffix}@example.com",
    }
    resp = await client.post("/patients/", json=payload, timeout=30)
    resp.raise_for_status()
    return str(resp.json()["id"])


async def _create_appointment(
    client: httpx.AsyncClient,
    *,
    internal_key: str,
    doctor_id: str,
    patient_id: str,
    when_dt: datetime,
    index: int,
    limiter: asyncio.Semaphore,
) -> ApiCreateResult:
    payload = {
        "doctor_id": doctor_id,
        "patient_id": patient_id,
        "date_time": when_dt.isoformat(),
        "reason": f"PERF test #{index}",
        "status": "scheduled",
    }
    headers = {
        "X-Internal-Key": internal_key,
        "Idempotency-Key": f"perf-create-{index}-{uuid.uuid4().hex}",
    }

    async with limiter:
        start = time.perf_counter()
        response = await client.post("/appointments", json=payload, headers=headers, timeout=60)
        latency_ms = (time.perf_counter() - start) * 1000.0

    appointment_id = None
    if response.status_code == 200:
        try:
            appointment_id = str(response.json().get("id"))
        except Exception:
            appointment_id = None

    return ApiCreateResult(
        ok=(response.status_code == 200 and bool(appointment_id)),
        appointment_id=appointment_id,
        status_code=response.status_code,
        latency_ms=latency_ms,
    )


def _fetch_google_outbox_state(engine, appointment_ids: list[str]) -> dict[str, int]:
    if not appointment_ids:
        return {
            "done": 0,
            "pending": 0,
            "processing": 0,
            "failed": 0,
            "total": 0,
        }

    ids_param = bindparam("ids", expanding=True)
    q = text(
        """
        SELECT
            SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) AS done_count,
            SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending_count,
            SUM(CASE WHEN status='processing' THEN 1 ELSE 0 END) AS processing_count,
            SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed_count,
            COUNT(*) AS total_count
        FROM google_outbox
        WHERE appointment_id IN :ids
          AND action='create'
        """
    ).bindparams(ids_param)

    with engine.begin() as conn:
        row = conn.execute(q, {"ids": appointment_ids}).mappings().first() or {}

    return {
        "done": int(row.get("done_count") or 0),
        "pending": int(row.get("pending_count") or 0),
        "processing": int(row.get("processing_count") or 0),
        "failed": int(row.get("failed_count") or 0),
        "total": int(row.get("total_count") or 0),
    }


def _measure_db_latency_samples(engine, appointment_ids: list[str], samples_per_id: int) -> list[float]:
    if not appointment_ids:
        return []

    appt_q = text(
        "SELECT id, status, google_sync_status, google_event_id FROM appointments WHERE id=:appointment_id"
    )
    outbox_q = text(
        """
        SELECT id, status, retries, processed_at
        FROM google_outbox
        WHERE appointment_id=:appointment_id AND action='create'
        ORDER BY created_at DESC
        LIMIT 1
        """
    )

    latencies_ms: list[float] = []
    with engine.begin() as conn:
        for appt_id in appointment_ids:
            for _ in range(max(1, samples_per_id)):
                start_a = time.perf_counter()
                conn.execute(appt_q, {"appointment_id": appt_id}).first()
                latencies_ms.append((time.perf_counter() - start_a) * 1000.0)

                start_b = time.perf_counter()
                conn.execute(outbox_q, {"appointment_id": appt_id}).first()
                latencies_ms.append((time.perf_counter() - start_b) * 1000.0)

    return latencies_ms


def _collect_google_async_latencies(engine, appointment_ids: list[str]) -> list[float]:
    if not appointment_ids:
        return []

    ids_param = bindparam("ids", expanding=True)
    q = text(
        """
        SELECT
            EXTRACT(EPOCH FROM (processed_at - created_at)) * 1000 AS latency_ms
        FROM google_outbox
        WHERE appointment_id IN :ids
          AND action='create'
          AND status='done'
          AND processed_at IS NOT NULL
        """
    ).bindparams(ids_param)

    # SQLite does not support EXTRACT(EPOCH ...), fallback handled below.
    try:
        with engine.begin() as conn:
            rows = conn.execute(q, {"ids": appointment_ids}).mappings().all()
            return [float(r.get("latency_ms") or 0.0) for r in rows]
    except Exception:
        q_fallback = text(
            """
            SELECT created_at, processed_at
            FROM google_outbox
            WHERE appointment_id IN :ids
              AND action='create'
              AND status='done'
              AND processed_at IS NOT NULL
            """
        ).bindparams(ids_param)
        with engine.begin() as conn:
            rows = conn.execute(q_fallback, {"ids": appointment_ids}).mappings().all()

        values: list[float] = []
        for row in rows:
            created_at = row.get("created_at")
            processed_at = row.get("processed_at")
            if created_at is None or processed_at is None:
                continue
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at)
            if isinstance(processed_at, str):
                processed_at = datetime.fromisoformat(processed_at)
            delta = processed_at - created_at
            values.append(delta.total_seconds() * 1000.0)
        return values


def _pick_existing_doctor_id(engine) -> str:
    query = text(
        """
        SELECT id
        FROM doctors
        ORDER BY created_at DESC
        LIMIT 1
        """
    )
    with engine.begin() as conn:
        row = conn.execute(query).first()
    if row is None:
        raise RuntimeError("No existing doctor found for fallback")
    return str(row[0])


def _pick_existing_patient_id(engine) -> str:
    query = text(
        """
        SELECT id
        FROM patients
        ORDER BY created_at DESC
        LIMIT 1
        """
    )
    with engine.begin() as conn:
        row = conn.execute(query).first()
    if row is None:
        raise RuntimeError("No existing patient found for fallback")
    return str(row[0])


def _detect_bottlenecks(api_stats: dict[str, float], db_stats: dict[str, float], google_stats: dict[str, float]) -> list[str]:
    findings: list[str] = []

    api_p95 = api_stats.get("p95_ms", 0.0)
    db_p95 = db_stats.get("p95_ms", 0.0)
    google_p95 = google_stats.get("p95_ms", 0.0)

    max_component = max(
        [("api", api_p95), ("db", db_p95), ("google_async", google_p95)],
        key=lambda item: item[1],
    )
    findings.append(f"dominant_p95_component={max_component[0]}:{round(max_component[1], 3)}ms")

    if api_p95 > 1200:
        findings.append("api_p95_high")
    if db_p95 > 120:
        findings.append("db_p95_high")
    if google_p95 > 10000:
        findings.append("google_async_p95_high")

    if api_p95 > 0 and db_p95 > 0 and api_p95 > (db_p95 * 6):
        findings.append("api_overhead_significantly_higher_than_db")
    if google_p95 > 0 and google_p95 > (api_p95 * 2):
        findings.append("google_async_pipeline_dominates_end_to_end")

    return findings


def _recommendations(bottlenecks: list[str]) -> list[str]:
    recs: list[str] = []

    if "api_p95_high" in bottlenecks:
        recs.append("Reducir trabajo sincrono en create appointment y mover tareas no criticas al outbox/event bus.")
        recs.append("Activar profiling de endpoint /appointments para detectar serializacion o validaciones costosas.")

    if "db_p95_high" in bottlenecks:
        recs.append("Revisar planes de ejecucion e indices en appointments(doctor_id,date_time) y google_outbox(status,next_attempt_at).")
        recs.append("Ajustar pool de conexiones y evitar contencion por transacciones largas en ventanas de pico.")

    if "google_async_p95_high" in bottlenecks:
        recs.append("Aumentar throughput del worker google_outbox (batch_limit, concurrencia controlada) sin exceder rate limits.")
        recs.append("Afinar retry/backoff y reconciliacion para reducir tiempos de convergencia a status done.")

    if "api_overhead_significantly_higher_than_db" in bottlenecks:
        recs.append("Analizar middlewares de autenticacion/idempotencia para minimizar costo por request.")

    if "google_async_pipeline_dominates_end_to_end" in bottlenecks:
        recs.append("Separar SLO de respuesta API (sincrono) del SLO de sincronizacion Google (eventual) y monitorear ambos por separado.")

    if not recs:
        recs.append("Latencias en rango esperado para este perfil de carga; mantener monitoreo de p95/p99 por componente.")

    return recs


async def main() -> None:
    api_base_url = os.getenv("PERF_API_BASE_URL", "http://localhost:8000/api/v1").rstrip("/")
    internal_key = _require_env("PERF_INTERNAL_API_KEY", fallback=os.getenv("GATEWAY_API_KEY"))
    database_url = _normalize_db_url(_require_env("DATABASE_URL"))

    total = int(os.getenv("PERF_TOTAL", "120"))
    concurrency = int(os.getenv("PERF_CONCURRENCY", "24"))
    spacing_minutes = int(os.getenv("PERF_SLOT_SPACING_MINUTES", "35"))
    start_delay_minutes = int(os.getenv("PERF_SLOT_START_DELAY_MINUTES", "20"))
    timeout_seconds = int(os.getenv("PERF_TIMEOUT_SECONDS", "300"))
    start_google_worker = _as_bool(os.getenv("PERF_START_GOOGLE_WORKER"), default=True)
    worker_interval_seconds = int(os.getenv("PERF_GOOGLE_WORKER_INTERVAL_SECONDS", "1"))
    worker_batch_limit = int(os.getenv("PERF_GOOGLE_WORKER_BATCH_LIMIT", "250"))
    db_samples_per_appointment = int(os.getenv("PERF_DB_SAMPLES_PER_APPOINTMENT", "2"))

    engine = create_engine(database_url)
    worker_proc: subprocess.Popen[str] | None = None

    suite_started = time.perf_counter()
    suffix = uuid.uuid4().hex[:8]

    try:
        if start_google_worker:
            worker_proc = _start_google_worker(worker_interval_seconds, worker_batch_limit)

        async with httpx.AsyncClient(base_url=api_base_url) as client:
            doctor_id = os.getenv("PERF_DOCTOR_ID", "").strip()
            patient_id = os.getenv("PERF_PATIENT_ID", "").strip()

            if not doctor_id:
                try:
                    doctor_id = await _create_doctor(client, suffix)
                except Exception:
                    doctor_id = _pick_existing_doctor_id(engine)

            if not patient_id:
                try:
                    patient_id = await _create_patient(client, suffix)
                except Exception:
                    patient_id = _pick_existing_patient_id(engine)

            limiter = asyncio.Semaphore(max(1, concurrency))
            base_dt = datetime.now(timezone.utc) + timedelta(minutes=start_delay_minutes)

            tasks = []
            for idx in range(total):
                when_dt = base_dt + timedelta(minutes=idx * spacing_minutes)
                tasks.append(
                    _create_appointment(
                        client,
                        internal_key=internal_key,
                        doctor_id=doctor_id,
                        patient_id=patient_id,
                        when_dt=when_dt,
                        index=idx,
                        limiter=limiter,
                    )
                )

            api_results = await asyncio.gather(*tasks)

        success = [r for r in api_results if r.ok and r.appointment_id]
        appointment_ids = [str(r.appointment_id) for r in success if r.appointment_id]
        api_latencies_ms = [r.latency_ms for r in api_results]

        deadline = time.perf_counter() + max(10, timeout_seconds)
        outbox_state = _fetch_google_outbox_state(engine, appointment_ids)
        while time.perf_counter() < deadline:
            outbox_state = _fetch_google_outbox_state(engine, appointment_ids)
            if outbox_state["done"] >= len(appointment_ids):
                break
            await asyncio.sleep(2)

        db_latencies_ms = _measure_db_latency_samples(engine, appointment_ids, db_samples_per_appointment)
        google_async_latencies_ms = _collect_google_async_latencies(engine, appointment_ids)

        api_stats = _stats(api_latencies_ms)
        db_stats = _stats(db_latencies_ms)
        google_stats = _stats(google_async_latencies_ms)

        api_5xx = sum(1 for r in api_results if r.status_code >= 500)
        api_non_2xx = sum(1 for r in api_results if r.status_code != 200)

        bottlenecks = _detect_bottlenecks(api_stats, db_stats, google_stats)
        recommendations = _recommendations(bottlenecks)

        report = {
            "scenario": {
                "appointments_requested": total,
                "concurrency": concurrency,
                "api_base_url": api_base_url,
                "google_worker_started": start_google_worker,
                "google_worker_interval_seconds": worker_interval_seconds,
                "google_worker_batch_limit": worker_batch_limit,
            },
            "latency_metrics": {
                "api": api_stats,
                "db": db_stats,
                "google_async": google_stats,
            },
            "throughput_health": {
                "api_success": len(success),
                "api_non_2xx": api_non_2xx,
                "api_5xx": api_5xx,
                "outbox_done": outbox_state["done"],
                "outbox_pending": outbox_state["pending"],
                "outbox_processing": outbox_state["processing"],
                "outbox_failed": outbox_state["failed"],
                "suite_duration_seconds": round(time.perf_counter() - suite_started, 3),
            },
            "bottlenecks": bottlenecks,
            "optimization_recommendations": recommendations,
        }

        print(json.dumps(report, indent=2, ensure_ascii=True))
    finally:
        _stop_process(worker_proc)


if __name__ == "__main__":
    asyncio.run(main())
