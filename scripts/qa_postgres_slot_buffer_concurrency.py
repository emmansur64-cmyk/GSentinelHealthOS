"""QA concurrency check for slot-based booking on real PostgreSQL.

What it does:
1) Creates a near-time window of slots for one doctor
2) Fires 20 concurrent bookings against nearby slots (real concurrent sessions)
3) Validates booking/buffer/link consistency under READ COMMITTED

Usage:
    e:/GSentinelHealthOS/.venv/Scripts/python.exe scripts/qa_postgres_slot_buffer_concurrency.py
"""

from __future__ import annotations

import asyncio
import json
import os
import random
import sys
import argparse
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from time import perf_counter
from typing import Any

from dotenv import load_dotenv
from sqlalchemy import Column, Integer, String, Table, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


# Ensure settings bootstrap does not fail on insecure placeholders.
os.environ.setdefault("GATEWAY_API_KEY", "test-gateway-key-valid")
os.environ.setdefault("BRAIN_API_KEY", "test-brain-key-valid")

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from api.app.models.time_slot_simple import Base
from api.app.services.time_slot_service_simple import TimeSlotService


@dataclass
class RunStats:
    total_requests: int
    ok_count: int
    fail_count: int
    error_histogram: dict[str, int]
    booked_count: int
    scheduled_appointments: int
    blocked_count: int
    slotbuffer_links: int
    blocked_without_links: int
    links_without_blocked: int
    adjacent_booked_pairs: int


@dataclass
class RequestTrace:
    request_id: int
    slot_id: int
    patient_id: int
    backend_pid: int | None
    txid: int | None
    target_start: str
    target_end: str
    delay_min_ms: int
    delay_max_ms: int
    ok: bool
    message: str
    latency_ms: float


@dataclass
class InvariantCheck:
    name: str
    sql: str
    failed_rows: list[dict[str, Any]]

    @property
    def passed(self) -> bool:
        return len(self.failed_rows) == 0


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="PostgreSQL slot-buffer concurrency QA")
    parser.add_argument(
        "--json-out",
        dest="json_out",
        default="",
        help="Optional path to write machine-readable QA results as JSON",
    )
    parser.add_argument(
        "--fail-on-deadlock",
        dest="fail_on_deadlock",
        action="store_true",
        help="Return exit code 1 if any deadlock is detected during the run",
    )
    parser.add_argument(
        "--requests",
        dest="requests",
        type=int,
        default=20,
        help="Concurrent booking requests to execute (default: 20)",
    )
    parser.add_argument(
        "--sla-p95-ms",
        dest="sla_p95_ms",
        type=float,
        default=0.0,
        help="If > 0, fail with exit code 1 when p95 latency exceeds this SLA threshold",
    )
    return parser.parse_args()


def _is_db_error(message: str) -> bool:
    lowered = message.lower()
    markers = (
        "psycopg.errors",
        "sqlalchemy.exc",
        "deadlock detected",
        "serialization",
        "uniqueviolation",
        "timeout",
        "connection",
        "database",
    )
    return any(marker in lowered for marker in markers)


def _ensure_metadata_dependency_tables() -> None:
    """Register dependency tables in ORM metadata for FK resolution in isolated QA runs."""
    if "doctors" not in Base.metadata.tables:
        Table(
            "doctors",
            Base.metadata,
            Column("id", Integer, primary_key=True),
            Column("name", String(255), nullable=False, server_default="Doctor QA"),
            Column("specialization", String(100), nullable=True),
            Column("buffer_before_minutes", Integer, nullable=False, server_default="0"),
            Column("buffer_after_minutes", Integer, nullable=False, server_default="0"),
        )

    if "patients" not in Base.metadata.tables:
        Table(
            "patients",
            Base.metadata,
            Column("id", Integer, primary_key=True),
            Column("name", String(255), nullable=False, server_default="Patient QA"),
        )


def _normalize_database_url(raw_url: str) -> str:
    if raw_url.startswith("postgresql+asyncpg://"):
        return raw_url
    if raw_url.startswith("postgresql+psycopg://"):
        return raw_url
    if raw_url.startswith("postgresql://"):
        return raw_url.replace("postgresql://", "postgresql+psycopg://", 1)
    raise RuntimeError("DATABASE_URL debe ser PostgreSQL")


async def _table_exists(db: AsyncSession, table_name: str) -> bool:
    value = await db.scalar(
        text(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = current_schema()
                  AND table_name = :table_name
            )
            """
        ),
        {"table_name": table_name},
    )
    return bool(value)


async def _column_exists(db: AsyncSession, table_name: str, column_name: str) -> bool:
    value = await db.scalar(
        text(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = :table_name
                  AND column_name = :column_name
            )
            """
        ),
        {"table_name": table_name, "column_name": column_name},
    )
    return bool(value)


async def _pick_existing_ids(db: AsyncSession) -> tuple[int, list[int]]:
    doctor_id = await db.scalar(text("SELECT id FROM doctors ORDER BY id LIMIT 1"))
    if doctor_id is None:
        raise RuntimeError("No hay doctors en BD para ejecutar la prueba")

    patient_rows = (
        await db.execute(text("SELECT id FROM patients ORDER BY id LIMIT 50"))
    ).scalars().all()
    patient_ids = [int(value) for value in patient_rows]
    if not patient_ids:
        raise RuntimeError("No hay patients en BD para ejecutar la prueba")

    return int(doctor_id), patient_ids


async def _set_buffers(db: AsyncSession, doctor_id: int, before_mins: int, after_mins: int) -> None:
    has_before = await _column_exists(db, "doctors", "buffer_before_minutes")
    has_after = await _column_exists(db, "doctors", "buffer_after_minutes")
    if has_before and has_after:
        await db.execute(
            text(
                """
                UPDATE doctors
                SET buffer_before_minutes = :before_mins,
                    buffer_after_minutes = :after_mins
                WHERE id = :doctor_id
                """
            ),
            {
                "doctor_id": doctor_id,
                "before_mins": before_mins,
                "after_mins": after_mins,
            },
        )
        return

    # Legacy fallback
    await db.execute(
        text(
            """
            INSERT INTO doctor_schedule_config (doctor_id, buffer_minutes)
            VALUES (:doctor_id, :buffer_minutes)
            ON CONFLICT (doctor_id)
            DO UPDATE SET buffer_minutes = EXCLUDED.buffer_minutes
            """
        ),
        {"doctor_id": doctor_id, "buffer_minutes": max(before_mins, after_mins)},
    )


async def _seed_slots(db: AsyncSession, doctor_id: int, base_utc: datetime, count: int) -> list[int]:
    slot_ids: list[int] = []
    for index in range(count):
        start = base_utc + timedelta(minutes=30 * index)
        end = start + timedelta(minutes=30)
        inserted = await db.scalar(
            text(
                """
                INSERT INTO time_slots (doctor_id, start_time, end_time, status)
                VALUES (:doctor_id, :start_time, :end_time, 'available')
                RETURNING id
                """
            ),
            {
                "doctor_id": doctor_id,
                "start_time": start,
                "end_time": end,
            },
        )
        slot_ids.append(int(inserted))
    return slot_ids


async def _seed_race_slots(db: AsyncSession, doctor_id: int, base_utc: datetime) -> list[int]:
    slot_ids: list[int] = []
    for offset in (0, 15, 30):
        start = base_utc + timedelta(minutes=offset)
        end = start + timedelta(minutes=15)
        inserted = await db.scalar(
            text(
                """
                INSERT INTO time_slots (doctor_id, start_time, end_time, status)
                VALUES (:doctor_id, :start_time, :end_time, 'available')
                RETURNING id
                """
            ),
            {
                "doctor_id": doctor_id,
                "start_time": start,
                "end_time": end,
            },
        )
        slot_ids.append(int(inserted))
    return slot_ids


async def _bootstrap_schema_if_needed(db: AsyncSession) -> None:
    """Create missing schema pieces needed for standalone QA runs on clean PostgreSQL."""
    _ensure_metadata_dependency_tables()

    def _create_all(sync_session: Any) -> None:
        Base.metadata.create_all(bind=sync_session.connection())

    await db.run_sync(_create_all)

    await db.execute(
        text(
            """
            INSERT INTO doctors (name, buffer_before_minutes, buffer_after_minutes)
            VALUES ('Doctor QA', 0, 0)
            ON CONFLICT DO NOTHING
            """
        )
    )
    await db.execute(
        text(
            """
            INSERT INTO patients (name)
            SELECT 'Patient QA ' || g::text
            FROM generate_series(1, 30) g
            ON CONFLICT DO NOTHING
            """
        )
    )


async def _book_one(
    session_factory: async_sessionmaker[AsyncSession],
    request_id: int,
    slot_id: int,
    patient_id: int,
) -> RequestTrace:
    deadlock_markers = (
        "deadlock detected",
        "DeadlockDetected",
        "could not serialize",
        "serialization failure",
    )

    max_attempts = 4
    for attempt in range(max_attempts):
        async with session_factory() as db:
            # Explicit READ COMMITTED per transaction.
            await db.execute(text("SET TRANSACTION ISOLATION LEVEL READ COMMITTED"))
            started = perf_counter()
            tx_meta = await db.execute(
                text(
                    """
                    SELECT pg_backend_pid() AS backend_pid,
                           txid_current() AS txid,
                           start_time,
                           end_time
                    FROM time_slots
                    WHERE id = :slot_id
                    """
                ),
                {"slot_id": slot_id},
            )
            meta = tx_meta.first()
            ok, _, err = await TimeSlotService.book_slot(
                db=db,
                slot_id=slot_id,
                patient_id=patient_id,
                priority="normal",
                allow_reassign=False,
            )
            message = err or "ok"
            if ok:
                elapsed_ms = (perf_counter() - started) * 1000.0
                return RequestTrace(
                    request_id=request_id,
                    slot_id=slot_id,
                    patient_id=patient_id,
                    backend_pid=int(meta[0]) if meta is not None else None,
                    txid=int(meta[1]) if meta is not None else None,
                    target_start=str(meta[2]) if meta is not None else "",
                    target_end=str(meta[3]) if meta is not None else "",
                    delay_min_ms=int(os.getenv("QA_BOOKING_DELAY_MIN_MS", "100") or "100"),
                    delay_max_ms=int(os.getenv("QA_BOOKING_DELAY_MAX_MS", "300") or "300"),
                    ok=True,
                    message="ok",
                    latency_ms=elapsed_ms,
                )

            if any(marker in message for marker in deadlock_markers) and attempt < (max_attempts - 1):
                await asyncio.sleep((0.03 * (2 ** attempt)) + random.uniform(0.0, 0.02))
                continue

            elapsed_ms = (perf_counter() - started) * 1000.0
            return RequestTrace(
                request_id=request_id,
                slot_id=slot_id,
                patient_id=patient_id,
                backend_pid=int(meta[0]) if meta is not None else None,
                txid=int(meta[1]) if meta is not None else None,
                target_start=str(meta[2]) if meta is not None else "",
                target_end=str(meta[3]) if meta is not None else "",
                delay_min_ms=int(os.getenv("QA_BOOKING_DELAY_MIN_MS", "100") or "100"),
                delay_max_ms=int(os.getenv("QA_BOOKING_DELAY_MAX_MS", "300") or "300"),
                ok=False,
                message=message,
                latency_ms=elapsed_ms,
            )

    return RequestTrace(
        request_id=request_id,
        slot_id=slot_id,
        patient_id=patient_id,
        backend_pid=None,
        txid=None,
        target_start="",
        target_end="",
        delay_min_ms=int(os.getenv("QA_BOOKING_DELAY_MIN_MS", "100") or "100"),
        delay_max_ms=int(os.getenv("QA_BOOKING_DELAY_MAX_MS", "300") or "300"),
        ok=False,
        message="retry_exhausted",
        latency_ms=0.0,
    )


async def _compute_stats(
    session_factory: async_sessionmaker[AsyncSession],
    doctor_id: int,
    slot_ids: list[int],
) -> tuple[int, int, int, int, int, int, int, int]:
    async with session_factory() as db:
        booked_count = int(
            (
                await db.execute(
                    text(
                        """
                        SELECT COUNT(*)
                        FROM time_slots
                        WHERE id = ANY(:slot_ids)
                          AND status = 'booked'
                        """
                    ),
                    {"slot_ids": slot_ids},
                )
            ).scalar_one()
        )
        scheduled_appointments = int(
            (
                await db.execute(
                    text(
                        """
                        SELECT COUNT(*)
                        FROM appointments
                        WHERE slot_id = ANY(:slot_ids)
                          AND status = 'scheduled'
                        """
                    ),
                    {"slot_ids": slot_ids},
                )
            ).scalar_one()
        )
        blocked_count = int(
            (
                await db.execute(
                    text(
                        """
                        SELECT COUNT(*)
                        FROM time_slots
                        WHERE id = ANY(:slot_ids)
                          AND status = 'blocked'
                        """
                    ),
                    {"slot_ids": slot_ids},
                )
            ).scalar_one()
        )
        slotbuffer_links = int(
            (
                await db.execute(
                    text(
                        """
                        SELECT COUNT(*)
                        FROM slot_buffer_blocks
                        WHERE blocked_slot_id = ANY(:slot_ids)
                        """
                    ),
                    {"slot_ids": slot_ids},
                )
            ).scalar_one()
        )
        blocked_without_links = int(
            (
                await db.execute(
                    text(
                        """
                        SELECT COUNT(*)
                        FROM time_slots ts
                        WHERE ts.id = ANY(:slot_ids)
                          AND ts.status = 'blocked'
                          AND NOT EXISTS (
                            SELECT 1
                            FROM slot_buffer_blocks sbb
                            WHERE sbb.blocked_slot_id = ts.id
                          )
                        """
                    ),
                    {"slot_ids": slot_ids},
                )
            ).scalar_one()
        )
        links_without_blocked = int(
            (
                await db.execute(
                    text(
                        """
                        SELECT COUNT(*)
                        FROM slot_buffer_blocks sbb
                        JOIN time_slots ts ON ts.id = sbb.blocked_slot_id
                        WHERE sbb.blocked_slot_id = ANY(:slot_ids)
                          AND ts.status <> 'blocked'
                        """
                    ),
                    {"slot_ids": slot_ids},
                )
            ).scalar_one()
        )
        available_with_active_buffer = int(
            (
                await db.execute(
                    text(
                        """
                        SELECT COUNT(*)
                        FROM time_slots ts
                        WHERE ts.id = ANY(:slot_ids)
                          AND ts.status = 'available'
                          AND EXISTS (
                            SELECT 1
                            FROM slot_buffer_blocks sbb
                            WHERE sbb.blocked_slot_id = ts.id
                          )
                        """
                    ),
                    {"slot_ids": slot_ids},
                )
            ).scalar_one()
        )
        adjacent_booked_pairs = int(
            (
                await db.execute(
                    text(
                        """
                        WITH ordered AS (
                            SELECT id, start_time, status,
                                   LAG(status) OVER (ORDER BY start_time) AS prev_status
                            FROM time_slots
                            WHERE id = ANY(:slot_ids)
                              AND doctor_id = :doctor_id
                        )
                        SELECT COUNT(*)
                        FROM ordered
                        WHERE status = 'booked' AND prev_status = 'booked'
                        """
                    ),
                    {"slot_ids": slot_ids, "doctor_id": doctor_id},
                )
            ).scalar_one()
        )
        overlapping_booked = int(
            (
                await db.execute(
                    text(
                        """
                        SELECT COUNT(*)
                        FROM time_slots
                        WHERE id = ANY(:slot_ids)
                          AND status = 'booked'
                        """
                    ),
                    {"slot_ids": slot_ids},
                )
            ).scalar_one()
        )

    return (
        booked_count,
        scheduled_appointments,
        blocked_count,
        slotbuffer_links,
        blocked_without_links,
        links_without_blocked,
        available_with_active_buffer,
        adjacent_booked_pairs,
        overlapping_booked,
    )


async def _run_invariant_checks(
        session_factory: async_sessionmaker[AsyncSession],
        doctor_id: int,
        slot_ids: list[int],
) -> list[InvariantCheck]:
        queries = {
                "slot_booked_has_appointment": """
                        SELECT ts.id, ts.start_time, ts.end_time, ts.status
                        FROM time_slots ts
                        WHERE ts.id = ANY(:slot_ids)
                            AND ts.status = 'booked'
                            AND NOT EXISTS (
                                SELECT 1
                                FROM appointments a
                                WHERE a.slot_id = ts.id
                                    AND a.status = 'scheduled'
                            )
                        ORDER BY ts.start_time ASC, ts.id ASC
                """,
                "slot_blocked_has_slotbufferblock": """
                        SELECT ts.id, ts.start_time, ts.end_time, ts.status
                        FROM time_slots ts
                        WHERE ts.id = ANY(:slot_ids)
                            AND ts.status = 'blocked'
                            AND NOT EXISTS (
                                SELECT 1
                                FROM slot_buffer_blocks sbb
                                WHERE sbb.blocked_slot_id = ts.id
                            )
                        ORDER BY ts.start_time ASC, ts.id ASC
                """,
                "slot_available_has_no_links": """
                        SELECT ts.id, ts.start_time, ts.end_time, ts.status
                        FROM time_slots ts
                        WHERE ts.id = ANY(:slot_ids)
                            AND ts.status = 'available'
                            AND EXISTS (
                                SELECT 1
                                FROM slot_buffer_blocks sbb
                                WHERE sbb.blocked_slot_id = ts.id
                            )
                        ORDER BY ts.start_time ASC, ts.id ASC
                """,
                "no_overlaps_within_buffer": """
                        WITH booked AS (
                                SELECT ts.id, ts.start_time, ts.end_time
                                FROM time_slots ts
                                WHERE ts.id = ANY(:slot_ids)
                                    AND ts.doctor_id = :doctor_id
                                    AND ts.status = 'booked'
                        )
                        SELECT b1.id AS slot_a_id,
                                     b2.id AS slot_b_id,
                                     b1.start_time AS slot_a_start,
                                     b2.start_time AS slot_b_start
                        FROM booked b1
                        JOIN booked b2 ON b1.id < b2.id
                        WHERE b2.start_time < b1.end_time + INTERVAL '30 minutes'
                            AND b1.start_time < b2.end_time + INTERVAL '30 minutes'
                        ORDER BY b1.start_time ASC, b2.start_time ASC
                """,
        }

        results: list[InvariantCheck] = []
        async with session_factory() as db:
                for name, sql in queries.items():
                        rows = (
                                await db.execute(
                                        text(sql),
                                        {"slot_ids": slot_ids, "doctor_id": doctor_id},
                                )
                        ).mappings().all()
                        results.append(
                                InvariantCheck(
                                        name=name,
                                        sql=sql.strip(),
                                        failed_rows=[dict(row) for row in rows],
                                )
                        )

        return results


async def _cleanup(session_factory: async_sessionmaker[AsyncSession], slot_ids: list[int]) -> None:
    async with session_factory() as db:
        await db.execute(
            text("DELETE FROM appointments WHERE slot_id = ANY(:slot_ids)"),
            {"slot_ids": slot_ids},
        )
        await db.execute(
            text(
                "DELETE FROM slot_buffer_blocks WHERE source_slot_id = ANY(:slot_ids) OR blocked_slot_id = ANY(:slot_ids)"
            ),
            {"slot_ids": slot_ids},
        )
        await db.execute(text("DELETE FROM time_slots WHERE id = ANY(:slot_ids)"), {"slot_ids": slot_ids})
        await db.commit()


async def main(
    json_out: str = "",
    fail_on_deadlock: bool = False,
    requests: int = 20,
    sla_p95_ms: float = 0.0,
) -> int:
    load_dotenv()

    raw_database_url = os.getenv("DATABASE_URL")
    if not raw_database_url:
        raise RuntimeError("Falta DATABASE_URL")
    database_url = _normalize_database_url(raw_database_url)

    engine = create_async_engine(
        database_url,
        pool_size=30,
        max_overflow=0,
        pool_pre_ping=True,
        isolation_level="READ COMMITTED",
        future=True,
    )
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False, autoflush=False)

    slot_ids: list[int] = []
    try:
        os.environ["QA_FORCE_BOOKING_RACE_DELAY"] = "1"
        os.environ["QA_BOOKING_DELAY_MIN_MS"] = "100"
        os.environ["QA_BOOKING_DELAY_MAX_MS"] = "300"

        async with session_factory() as db:
            await _bootstrap_schema_if_needed(db)
            await db.commit()

            for table in ("time_slots", "appointments", "slot_buffer_blocks", "doctors", "patients"):
                if not await _table_exists(db, table):
                    raise RuntimeError(f"Falta tabla requerida: {table}")

            doctor_id, patient_ids_pool = await _pick_existing_ids(db)
            await _set_buffers(db, doctor_id=doctor_id, before_mins=30, after_mins=30)

            base_utc = (datetime.now(timezone.utc) + timedelta(days=2)).replace(hour=14, minute=0, second=0, microsecond=0)
            slot_ids = await _seed_race_slots(db, doctor_id=doctor_id, base_utc=base_utc)
            await db.commit()

        # Concurrent bookings on the same buffer window (14:00, 14:15, 14:30).
        request_payloads: list[tuple[int, int]] = []
        hot_slot_ids = [slot_ids[0], slot_ids[1], slot_ids[2]]
        for _ in range(requests):
            request_payloads.append((random.choice(hot_slot_ids), random.choice(patient_ids_pool)))

        run_start = perf_counter()
        traces = await asyncio.gather(
            *[
                _book_one(session_factory, request_id=index + 1, slot_id=slot_id, patient_id=patient_id)
                for index, (slot_id, patient_id) in enumerate(request_payloads)
            ]
        )
        run_elapsed_ms = (perf_counter() - run_start) * 1000.0

        ok_count = sum(1 for trace in traces if trace.ok)
        fail_count = len(traces) - ok_count
        error_hist = Counter(trace.message for trace in traces if not trace.ok)
        deadlock_count = sum(
            1
            for trace in traces
            if "deadlock detected" in trace.message.lower() or "deadlockdetected" in trace.message.lower()
        )
        db_error_count = sum(1 for trace in traces if (not trace.ok) and _is_db_error(trace.message))
        avg_latency_ms = (sum(trace.latency_ms for trace in traces) / len(traces)) if traces else 0.0
        p95_latency_ms = 0.0
        if traces:
            sorted_latencies = sorted(trace.latency_ms for trace in traces)
            p95_index = max(0, min(len(sorted_latencies) - 1, int(len(sorted_latencies) * 0.95) - 1))
            p95_latency_ms = sorted_latencies[p95_index]

        (
            booked_count,
            scheduled_appointments,
            blocked_count,
            slotbuffer_links,
            blocked_without_links,
            links_without_blocked,
            available_with_active_buffer,
            adjacent_booked_pairs,
            overlapping_booked,
        ) = await _compute_stats(session_factory, doctor_id=doctor_id, slot_ids=slot_ids)
        invariant_checks = await _run_invariant_checks(session_factory, doctor_id=doctor_id, slot_ids=slot_ids)
        invariant_failures = [check for check in invariant_checks if not check.passed]

        stats = RunStats(
            total_requests=len(traces),
            ok_count=ok_count,
            fail_count=fail_count,
            error_histogram=dict(error_hist),
            booked_count=booked_count,
            scheduled_appointments=scheduled_appointments,
            blocked_count=blocked_count,
            slotbuffer_links=slotbuffer_links,
            blocked_without_links=blocked_without_links,
            links_without_blocked=links_without_blocked,
            adjacent_booked_pairs=adjacent_booked_pairs,
        )

        print("\n=== PostgreSQL Concurrent Slot QA ===")
        print(f"requests_total: {stats.total_requests}")
        print(f"book_ok: {stats.ok_count}")
        print(f"book_fail: {stats.fail_count}")
        print(f"run_elapsed_ms: {run_elapsed_ms:.2f}")
        print(f"avg_request_latency_ms: {avg_latency_ms:.2f}")
        print(f"p95_request_latency_ms: {p95_latency_ms:.2f}")
        if sla_p95_ms > 0:
            print(f"sla_p95_ms: {sla_p95_ms:.2f}")
            print("- p95 <= SLA: OK" if p95_latency_ms <= sla_p95_ms else "- p95 <= SLA: FAIL")
        print(f"error_histogram: {stats.error_histogram}")
        print(f"booked_slots: {stats.booked_count}")
        print(f"scheduled_appointments: {stats.scheduled_appointments}")
        print(f"blocked_slots: {stats.blocked_count}")
        print(f"slot_buffer_links: {stats.slotbuffer_links}")
        print(f"blocked_without_links: {stats.blocked_without_links}")
        print(f"links_without_blocked: {stats.links_without_blocked}")
        print(f"adjacent_booked_pairs: {stats.adjacent_booked_pairs}")
        print(f"overlapping_booked_in_same_buffer_window: {overlapping_booked}")
        print(f"deadlock_detected_count: {deadlock_count}")
        print(f"db_error_count: {db_error_count}")

        print("\n=== Queries SQL ===")
        for check in invariant_checks:
            print(f"[{check.name}]\n{check.sql}")

        print("\n=== Logs por transaccion ===")
        for trace in sorted(traces, key=lambda item: item.request_id):
            print(
                "request_id={request_id} backend_pid={backend_pid} txid={txid} slot_id={slot_id} "
                "target_start={target_start} target_end={target_end} delay_ms={delay_min}-{delay_max} "
                "result={result} latency_ms={latency_ms} message={message}".format(
                    request_id=trace.request_id,
                    backend_pid=trace.backend_pid,
                    txid=trace.txid,
                    slot_id=trace.slot_id,
                    target_start=trace.target_start,
                    target_end=trace.target_end,
                    delay_min=trace.delay_min_ms,
                    delay_max=trace.delay_max_ms,
                    result="OK" if trace.ok else "FAIL",
                    latency_ms=f"{trace.latency_ms:.2f}",
                    message=trace.message,
                )
            )

        no_double_booking_ok = stats.booked_count == stats.scheduled_appointments and overlapping_booked <= 1
        buffers_ok = stats.adjacent_booked_pairs == 0
        links_consistency_ok = stats.blocked_without_links == 0 and stats.links_without_blocked == 0
        race_evidence = {
            "same_window_targets": sorted({trace.slot_id for trace in traces}),
            "successful_bookings_same_window": overlapping_booked,
            "failed_due_to_buffer_or_availability": fail_count,
            "artificial_delay_enabled": True,
            "delay_range_ms": [100, 300],
            "deadlock_detected_count": deadlock_count,
            "db_error_count": db_error_count,
        }

        print("\n=== Validaciones QA ===")
        print("- mas de 1 booking dentro del mismo rango: OK" if no_double_booking_ok else "- mas de 1 booking dentro del mismo rango: FAIL")
        print("- slots inconsistentes (available + buffer activo): OK" if available_with_active_buffer == 0 else "- slots inconsistentes (available + buffer activo): FAIL")
        print("- SlotBufferBlock sin correspondencia: OK" if links_consistency_ok else "- SlotBufferBlock sin correspondencia: FAIL")
        print("- invariantes post-test: OK" if not invariant_failures else "- invariantes post-test: FAIL")

        print("\n=== Checks automaticos ===")
        for check in invariant_checks:
            status = "OK" if check.passed else "FAIL"
            print(f"- {check.name}: {status}")
            if not check.passed:
                for row in check.failed_rows:
                    print(f"  inconsistency={row}")

        print("\n=== Evidencia de race condition ===")
        print(json.dumps(race_evidence, ensure_ascii=True, indent=2))

        print("\n=== Diferencias vs SQLite ===")
        print("1) PostgreSQL aplica bloqueo por fila real; SQLite no replica FOR UPDATE de forma estricta.")
        print("2) En PostgreSQL READ COMMITTED, cada transaccion ve commits recientes; SQLite suele serializar por lock de archivo.")
        print("3) En SQLite pueden aparecer falsos positivos/negativos de carrera; en PostgreSQL la contencion es mas representativa de produccion.")

        print("\n=== Riesgos detectados ===")
        risks: list[str] = []
        if not no_double_booking_ok:
            risks.append("Desalineacion booked vs appointments (posible doble booking o rollback parcial).")
        if available_with_active_buffer > 0:
            risks.append("Hay slots available con buffer activo, inconsistencia de estado.")
        if stats.blocked_without_links > 0 or stats.links_without_blocked > 0:
            risks.append("Hay desalineacion entre blocked y SlotBufferBlock.")
        if deadlock_count > 0:
            risks.append("Se detectaron deadlocks durante la corrida concurrente.")
        if invariant_failures:
            risks.append("Fallaron invariantes post-test; revisar log de inconsistencias.")
        if not risks:
            print("Sin riesgos criticos detectados en esta corrida.")
        else:
            for item in risks:
                print(f"- {item}")

        if json_out:
            payload = {
                "requests_total": stats.total_requests,
                "book_ok": stats.ok_count,
                "book_fail": stats.fail_count,
                "run_elapsed_ms": run_elapsed_ms,
                "avg_request_latency_ms": avg_latency_ms,
                "p95_request_latency_ms": p95_latency_ms,
                "error_histogram": stats.error_histogram,
                "booked_slots": stats.booked_count,
                "scheduled_appointments": stats.scheduled_appointments,
                "blocked_slots": stats.blocked_count,
                "slot_buffer_links": stats.slotbuffer_links,
                "blocked_without_links": stats.blocked_without_links,
                "links_without_blocked": stats.links_without_blocked,
                "available_with_active_buffer": available_with_active_buffer,
                "adjacent_booked_pairs": stats.adjacent_booked_pairs,
                "overlapping_booked_in_same_buffer_window": overlapping_booked,
                "deadlock_detected_count": deadlock_count,
                "db_error_count": db_error_count,
                "validations": {
                    "same_buffer_window_single_booking": no_double_booking_ok,
                    "no_available_with_active_buffer": available_with_active_buffer == 0,
                    "slotbuffer_link_consistency": links_consistency_ok,
                    "no_deadlocks_detected": deadlock_count == 0,
                    "invariants_passed": len(invariant_failures) == 0,
                },
                "invariant_checks": [
                    {
                        "name": check.name,
                        "sql": check.sql,
                        "passed": check.passed,
                        "failed_rows": check.failed_rows,
                    }
                    for check in invariant_checks
                ],
                "transaction_logs": [trace.__dict__ for trace in traces],
                "race_condition_evidence": race_evidence,
                "risks": risks,
                "differences_vs_sqlite": [
                    "PostgreSQL aplica bloqueo por fila real; SQLite no replica FOR UPDATE de forma estricta.",
                    "En PostgreSQL READ COMMITTED, cada transaccion ve commits recientes; SQLite suele serializar por lock de archivo.",
                    "En SQLite pueden aparecer falsos positivos/negativos de carrera; en PostgreSQL la contencion es mas representativa de produccion.",
                ],
            }
            output_path = Path(json_out)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(json.dumps(payload, ensure_ascii=True, indent=2), encoding="utf-8")
            print(f"\nJSON QA escrito en: {output_path}")

        if fail_on_deadlock and deadlock_count > 0:
            print("\nCI RESULT: FAIL por deadlock detectado")
            return 1

        if sla_p95_ms > 0 and p95_latency_ms > sla_p95_ms:
            print("\nCI RESULT: FAIL por SLA p95 excedida")
            return 1

        if invariant_failures:
            print("\nTEST RESULT: FAIL por invariantes violadas")
            return 1

        return 0
    finally:
        if slot_ids:
            try:
                await _cleanup(session_factory, slot_ids)
            except Exception:
                pass
        await engine.dispose()


if __name__ == "__main__":
    args = _parse_args()
    raise SystemExit(
        asyncio.run(
            main(
                json_out=args.json_out,
                fail_on_deadlock=args.fail_on_deadlock,
                requests=args.requests,
                sla_p95_ms=args.sla_p95_ms,
            )
        )
    )
