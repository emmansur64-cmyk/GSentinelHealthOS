from __future__ import annotations

import asyncio
import os
import sys
import tempfile
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import Column, Integer, Table, bindparam, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


os.environ.setdefault("GATEWAY_API_KEY", "test-gateway-key-valid")
os.environ.setdefault("BRAIN_API_KEY", "test-brain-key-valid")

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from api.app.models.time_slot_simple import Appointment, Base, TimeSlot
from api.app.services.time_slot_service_simple import TimeSlotService


@dataclass
class CaseResult:
    case_id: str
    title: str
    passed: bool
    criteria: str
    details: str


def _print_case(result: CaseResult) -> None:
    status = "PASS" if result.passed else "FAIL"
    print(f"[{status}] {result.case_id} - {result.title}")
    print(f"  Criteria: {result.criteria}")
    print(f"  Details: {result.details}")


async def _build_session_factory(db_path: Path) -> async_sessionmaker[AsyncSession]:
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}", echo=False, future=True)

    if "doctors" not in Base.metadata.tables:
        Table(
            "doctors",
            Base.metadata,
            Column("id", Integer, primary_key=True),
            Column("buffer_before_minutes", Integer, nullable=False, default=0),
            Column("buffer_after_minutes", Integer, nullable=False, default=0),
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
    session_factory._qa_engine = engine  # type: ignore[attr-defined]
    return session_factory


async def _dispose_session_factory(session_factory: async_sessionmaker[AsyncSession]) -> None:
    engine = getattr(session_factory, "_qa_engine", None)
    if engine is not None:
        await engine.dispose()


async def _reserve_required_resources_for_slot_stub(db: AsyncSession, slot_id: int, slot_start: Any, slot_end: Any) -> tuple[bool, str, int, int]:
    return (True, "", 0, 0)


async def _release_required_resources_for_slot_stub(db: AsyncSession, slot_id: int, slot_start: Any, slot_end: Any) -> int:
    return 0


async def _release_buffer_slots_sqlite(
    db: AsyncSession,
    doctor_id: int,
    released_slot_id: int,
    released_start: datetime,
    released_end: datetime,
    buffer_before_minutes: int,
    buffer_after_minutes: int,
) -> int:
    if buffer_before_minutes <= 0 and buffer_after_minutes <= 0:
        return 0

    window_start = released_start - timedelta(minutes=max(0, buffer_before_minutes))
    window_end = released_end + timedelta(minutes=max(0, buffer_after_minutes))

    candidates = (
        await db.execute(
            select(TimeSlot)
            .where(
                TimeSlot.doctor_id == doctor_id,
                TimeSlot.status == "blocked",
                TimeSlot.start_time >= window_start,
                TimeSlot.start_time < window_end,
            )
            .order_by(TimeSlot.start_time.asc())
        )
    ).scalars().all()

    active_bookings = (
        await db.execute(
            select(TimeSlot)
            .join(Appointment, Appointment.slot_id == TimeSlot.id)
            .where(
                TimeSlot.doctor_id == doctor_id,
                TimeSlot.status == "booked",
                Appointment.status == "scheduled",
                TimeSlot.id != released_slot_id,
            )
        )
    ).scalars().all()

    releasable_ids: list[int] = []
    for slot in candidates:
        still_blocked = False
        for booked in active_bookings:
            before_start = booked.start_time - timedelta(minutes=max(0, buffer_before_minutes))
            after_end = booked.end_time + timedelta(minutes=max(0, buffer_after_minutes))
            if (before_start <= slot.start_time < booked.start_time) or (booked.end_time <= slot.start_time < after_end):
                still_blocked = True
                break

        if not still_blocked:
            releasable_ids.append(int(slot.id))

    if not releasable_ids:
        return 0

    result = await db.execute(
        text(
            """
            UPDATE time_slots
            SET status = 'available'
            WHERE id IN :slot_ids
            """
        ).bindparams(bindparam("slot_ids", expanding=True)),
        {"slot_ids": releasable_ids},
    )
    return int(result.rowcount or 0)


class _PatchedService:
    def __init__(self) -> None:
        self.google_calls: list[dict[str, Any]] = []
        self._originals = {
            "_reserve_required_resources_for_slot": TimeSlotService._reserve_required_resources_for_slot,
            "_release_required_resources_for_slot": TimeSlotService._release_required_resources_for_slot,
            "_enqueue_google_create_for_appointment": TimeSlotService._enqueue_google_create_for_appointment,
            "_enqueue_google_delete_for_appointment": TimeSlotService._enqueue_google_delete_for_appointment,
        }

    async def __aenter__(self) -> "_PatchedService":
        async def _google_create_stub(db: AsyncSession, appointment_id: int) -> None:
            self.google_calls.append({"action": "create", "appointment_id": appointment_id})

        async def _google_delete_stub(db: AsyncSession, appointment_id: int, google_event_id: str | None) -> None:
            self.google_calls.append(
                {
                    "action": "delete",
                    "appointment_id": appointment_id,
                    "google_event_id": google_event_id,
                }
            )

        TimeSlotService._reserve_required_resources_for_slot = staticmethod(_reserve_required_resources_for_slot_stub)
        TimeSlotService._release_required_resources_for_slot = staticmethod(_release_required_resources_for_slot_stub)
        TimeSlotService._enqueue_google_create_for_appointment = staticmethod(_google_create_stub)
        TimeSlotService._enqueue_google_delete_for_appointment = staticmethod(_google_delete_stub)
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        for name, original in self._originals.items():
            setattr(TimeSlotService, name, original)


async def _seed_doctor_patient_slots(
    session_factory: async_sessionmaker[AsyncSession],
    *,
    doctor_id: int,
    patient_ids: list[int],
    buffer_before_minutes: int,
    buffer_after_minutes: int,
    base: datetime,
    count: int,
) -> list[int]:
    async with session_factory() as db:
        await db.execute(
            text(
                """
                INSERT INTO doctors (id, buffer_before_minutes, buffer_after_minutes)
                VALUES (:doctor_id, :before_minutes, :after_minutes)
                """
            ),
            {
                "doctor_id": doctor_id,
                "before_minutes": buffer_before_minutes,
                "after_minutes": buffer_after_minutes,
            },
        )
        for patient_id in patient_ids:
            await db.execute(text("INSERT INTO patients (id) VALUES (:patient_id)"), {"patient_id": patient_id})

        slots: list[TimeSlot] = []
        for index in range(count):
            start = base + timedelta(minutes=30 * index)
            slots.append(
                TimeSlot(
                    doctor_id=doctor_id,
                    start_time=start,
                    end_time=start + timedelta(minutes=30),
                    status="available",
                )
            )
        db.add_all(slots)
        await db.commit()
        for slot in slots:
            await db.refresh(slot)
        return [int(slot.id) for slot in slots]


async def _slot_statuses(session_factory: async_sessionmaker[AsyncSession]) -> dict[int, str]:
    async with session_factory() as db:
        rows = (await db.execute(select(TimeSlot).order_by(TimeSlot.start_time.asc()))).scalars().all()
        return {int(row.id): str(row.status) for row in rows}


async def _appointment_count(session_factory: async_sessionmaker[AsyncSession]) -> int:
    async with session_factory() as db:
        return int((await db.execute(select(func.count()).select_from(Appointment))).scalar_one())


async def _case_1_normal_booking() -> CaseResult:
    with tempfile.TemporaryDirectory(prefix="qa_buffers_case1_") as tmp_dir:
        session_factory = await _build_session_factory(Path(tmp_dir) / "case1.db")
        try:
            async with _PatchedService() as patched:
                slot_ids = await _seed_doctor_patient_slots(
                    session_factory,
                    doctor_id=1,
                    patient_ids=[100],
                    buffer_before_minutes=30,
                    buffer_after_minutes=30,
                    base=datetime(2026, 4, 20, 9, 0, 0),
                    count=3,
                )
                async with session_factory() as db:
                    ok, appointment_id, err = await TimeSlotService.book_slot(db=db, slot_id=slot_ids[1], patient_id=100)

                statuses = await _slot_statuses(session_factory)
                passed = bool(ok and appointment_id is not None and statuses[slot_ids[0]] == "blocked" and statuses[slot_ids[1]] == "booked" and statuses[slot_ids[2]] == "blocked")
                details = f"booking_ok={ok}, appointment_id={appointment_id}, statuses={statuses}, google_calls={patched.google_calls}"
                return CaseResult(
                    case_id="1",
                    title="Reserva normal",
                    passed=passed,
                    criteria="PASS si el slot reservado queda en booked y los slots vecinos dentro del buffer quedan en blocked.",
                    details=details if passed else f"expected booked+blocked neighbors, got err={err}, {details}",
                )
        finally:
            await _dispose_session_factory(session_factory)


async def _case_2_concurrent_booking_inside_buffer() -> CaseResult:
    with tempfile.TemporaryDirectory(prefix="qa_buffers_case2_") as tmp_dir:
        session_factory = await _build_session_factory(Path(tmp_dir) / "case2.db")
        try:
            async with _PatchedService():
                slot_ids = await _seed_doctor_patient_slots(
                    session_factory,
                    doctor_id=1,
                    patient_ids=[100, 101],
                    buffer_before_minutes=30,
                    buffer_after_minutes=30,
                    base=datetime(2026, 4, 20, 9, 0, 0),
                    count=3,
                )

                async def _book(slot_id: int, patient_id: int) -> tuple[bool, int | None, str]:
                    async with session_factory() as db:
                        return await TimeSlotService.book_slot(db=db, slot_id=slot_id, patient_id=patient_id)

                results = await asyncio.gather(
                    _book(slot_ids[1], 100),
                    _book(slot_ids[2], 101),
                )

                success_count = sum(1 for ok, _, _ in results if ok)
                statuses = await _slot_statuses(session_factory)
                appointments = await _appointment_count(session_factory)
                passed = success_count == 1 and appointments == 1
                details = f"results={results}, statuses={statuses}, appointments={appointments}"
                return CaseResult(
                    case_id="2",
                    title="Reserva concurrente dentro del buffer",
                    passed=passed,
                    criteria="PASS si solo una reserva concurrente sobre slots que se pisan por buffer logra confirmarse; la otra debe rechazarse y no debe haber 2 appointments activos.",
                    details=details,
                )
        finally:
            await _dispose_session_factory(session_factory)


async def _case_3_cancellation_releases_buffers() -> CaseResult:
    with tempfile.TemporaryDirectory(prefix="qa_buffers_case3_") as tmp_dir:
        session_factory = await _build_session_factory(Path(tmp_dir) / "case3.db")
        try:
            async with _PatchedService():
                slot_ids = await _seed_doctor_patient_slots(
                    session_factory,
                    doctor_id=1,
                    patient_ids=[100],
                    buffer_before_minutes=30,
                    buffer_after_minutes=30,
                    base=datetime(2026, 4, 20, 9, 0, 0),
                    count=3,
                )
                async with session_factory() as db:
                    ok, appointment_id, err = await TimeSlotService.book_slot(db=db, slot_id=slot_ids[1], patient_id=100)
                if not ok or appointment_id is None:
                    return CaseResult(
                        case_id="3",
                        title="Cancelación libera buffers",
                        passed=False,
                        criteria="PASS si al cancelar el appointment el slot principal vuelve a available y los buffers ya no quedan bloqueados sin motivo.",
                        details=f"precondition booking failed: err={err}",
                    )

                async with session_factory() as db:
                    cancelled, released_slot_id, cancel_err = await TimeSlotService.cancel_appointment(db=db, appointment_id=appointment_id)

                statuses = await _slot_statuses(session_factory)
                appointments = await _appointment_count(session_factory)
                passed = bool(cancelled and released_slot_id == slot_ids[1] and appointments == 0 and all(status == "available" for status in statuses.values()))
                details = f"cancelled={cancelled}, released_slot_id={released_slot_id}, cancel_err={cancel_err}, statuses={statuses}, appointments={appointments}"
                return CaseResult(
                    case_id="3",
                    title="Cancelación libera buffers",
                    passed=passed,
                    criteria="PASS si al cancelar el appointment el slot principal vuelve a available y los buffers ya no quedan bloqueados sin motivo.",
                    details=details,
                )
        finally:
            await _dispose_session_factory(session_factory)


async def _case_4_multiple_appointments_shared_buffer() -> CaseResult:
    with tempfile.TemporaryDirectory(prefix="qa_buffers_case4_") as tmp_dir:
        session_factory = await _build_session_factory(Path(tmp_dir) / "case4.db")
        try:
            async with _PatchedService():
                slot_ids = await _seed_doctor_patient_slots(
                    session_factory,
                    doctor_id=1,
                    patient_ids=[101, 102],
                    buffer_before_minutes=30,
                    buffer_after_minutes=30,
                    base=datetime(2026, 4, 20, 9, 0, 0),
                    count=5,
                )

                async with session_factory() as db:
                    ok1, appt1, err1 = await TimeSlotService.book_slot(db=db, slot_id=slot_ids[1], patient_id=101)
                    ok2, appt2, err2 = await TimeSlotService.book_slot(db=db, slot_id=slot_ids[3], patient_id=102)
                    if not ok1 or appt1 is None or not ok2 or appt2 is None:
                        return CaseResult(
                            case_id="4",
                            title="Múltiples turnos con buffer compartido",
                            passed=False,
                            criteria="PASS si al cancelar uno de dos turnos, los buffers compartidos que todavía cubre el otro turno permanecen bloqueados y no se liberan de más.",
                            details=f"precondition failed: first=({ok1}, {appt1}, {err1}), second=({ok2}, {appt2}, {err2})",
                        )
                    cancelled, released_slot_id, cancel_err = await TimeSlotService.cancel_appointment(db=db, appointment_id=appt1)

                statuses = await _slot_statuses(session_factory)
                passed = bool(cancelled and released_slot_id == slot_ids[1] and statuses[slot_ids[0]] == "available" and statuses[slot_ids[2]] == "blocked" and statuses[slot_ids[3]] == "booked")
                details = f"cancelled={cancelled}, cancel_err={cancel_err}, statuses={statuses}"
                return CaseResult(
                    case_id="4",
                    title="Múltiples turnos con buffer compartido",
                    passed=passed,
                    criteria="PASS si al cancelar uno de dos turnos, los buffers compartidos que todavía cubre el otro turno permanecen bloqueados y no se liberan de más.",
                    details=details,
                )
        finally:
            await _dispose_session_factory(session_factory)


async def _case_5_google_appointment_only() -> CaseResult:
    with tempfile.TemporaryDirectory(prefix="qa_buffers_case5_") as tmp_dir:
        session_factory = await _build_session_factory(Path(tmp_dir) / "case5.db")
        try:
            async with _PatchedService() as patched:
                slot_ids = await _seed_doctor_patient_slots(
                    session_factory,
                    doctor_id=1,
                    patient_ids=[100],
                    buffer_before_minutes=30,
                    buffer_after_minutes=30,
                    base=datetime(2026, 4, 20, 9, 0, 0),
                    count=3,
                )
                async with session_factory() as db:
                    ok, appointment_id, err = await TimeSlotService.book_slot(db=db, slot_id=slot_ids[1], patient_id=100)
                if not ok or appointment_id is None:
                    return CaseResult(
                        case_id="5",
                        title="Google solo refleja appointments",
                        passed=False,
                        criteria="PASS si booking genera exactamente 1 create Google y cancelación exactamente 1 delete Google para el appointment; los slots blocked no deben producir operaciones Google.",
                        details=f"precondition booking failed: err={err}",
                    )

                create_calls = list(patched.google_calls)

                async with session_factory() as db:
                    appointment = await db.scalar(select(Appointment).where(Appointment.id == appointment_id))
                    if appointment is None:
                        return CaseResult(
                            case_id="5",
                            title="Google solo refleja appointments",
                            passed=False,
                            criteria="PASS si booking genera exactamente 1 create Google y cancelación exactamente 1 delete Google para el appointment; los slots blocked no deben producir operaciones Google.",
                            details="appointment not found after booking",
                        )
                    appointment.google_event_id = "evt-slot-based-qa"
                    await db.commit()

                patched.google_calls.clear()

                async with session_factory() as db:
                    cancelled, released_slot_id, cancel_err = await TimeSlotService.cancel_appointment(db=db, appointment_id=appointment_id)

                delete_calls = list(patched.google_calls)
                statuses = await _slot_statuses(session_factory)
                passed = bool(
                    len(create_calls) == 1
                    and create_calls[0]["action"] == "create"
                    and create_calls[0]["appointment_id"] == appointment_id
                    and cancelled
                    and released_slot_id == slot_ids[1]
                    and len(delete_calls) == 1
                    and delete_calls[0]["action"] == "delete"
                    and delete_calls[0]["appointment_id"] == appointment_id
                    and delete_calls[0]["google_event_id"] == "evt-slot-based-qa"
                    and all(status in {"available", "booked", "blocked"} for status in statuses.values())
                )
                details = f"create_calls={create_calls}, delete_calls={delete_calls}, cancelled={cancelled}, cancel_err={cancel_err}, statuses={statuses}"
                return CaseResult(
                    case_id="5",
                    title="Google solo refleja appointments",
                    passed=passed,
                    criteria="PASS si booking genera exactamente 1 create Google y cancelación exactamente 1 delete Google para el appointment; los slots blocked no deben producir operaciones Google.",
                    details=details,
                )
        finally:
            await _dispose_session_factory(session_factory)


BUFFER_QA_CASES = [
    _case_1_normal_booking,
    _case_2_concurrent_booking_inside_buffer,
    _case_3_cancellation_releases_buffers,
    _case_4_multiple_appointments_shared_buffer,
    _case_5_google_appointment_only,
]


async def run_all_cases() -> list[CaseResult]:
    return [await case() for case in BUFFER_QA_CASES]


async def _run() -> int:
    results = await run_all_cases()

    print("QA VALIDATION - BUFFER SYSTEM")
    print("=" * 40)
    for result in results:
        _print_case(result)

    passed = sum(1 for result in results if result.passed)
    failed = len(results) - passed
    print("=" * 40)
    print(f"Summary: {passed} passed / {failed} failed / {len(results)} total")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    try:
        raise SystemExit(asyncio.run(_run()))
    except KeyboardInterrupt:
        print("Interrupted")
        raise SystemExit(130)