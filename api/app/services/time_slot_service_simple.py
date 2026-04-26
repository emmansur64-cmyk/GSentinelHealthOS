"""Simplified service layer for slot-based appointments.

Core operations:
✓ generate_daily_slots: Create slots for a doctor
✓ book_slot: Atomic booking (UPDATE without SELECT = no race condition)
✓ cancel_appointment: Release slot back to available
"""
from datetime import datetime, date, time, timedelta
from typing import Optional, List, Dict, Tuple, Any, Iterable
import asyncio
import logging
import os
import random
from typing import cast

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, update, delete
from sqlalchemy import func
from sqlalchemy import bindparam
from sqlalchemy.sql import text
from api.app.models.models import Doctor

from api.app.models.time_slot_simple import (
    TimeSlot,
    Appointment,
    AppointmentReassignmentAudit,
    DoctorScheduleConfig,
    SpecialtyPriorityPolicy,
    SlotBufferBlock,
    SlotResourceRequirement,
)

logger = logging.getLogger(__name__)


class TimeSlotService:
    """Service for slot-based appointment management."""

    @staticmethod
    async def _maybe_inject_booking_race_delay(
        db: AsyncSession,
        slot_id: int,
    ) -> None:
        """Inject a deterministic QA-only delay after validation, before write.

        This is disabled by default and only activates when the dedicated env var
        is set by concurrency QA scripts.
        """
        if os.getenv("QA_FORCE_BOOKING_RACE_DELAY", "0").strip() not in {"1", "true", "TRUE", "yes", "YES"}:
            return

        min_delay_ms = int(os.getenv("QA_BOOKING_DELAY_MIN_MS", "100") or "100")
        max_delay_ms = int(os.getenv("QA_BOOKING_DELAY_MAX_MS", "300") or "300")
        if max_delay_ms < min_delay_ms:
            max_delay_ms = min_delay_ms

        delay_ms = random.randint(min_delay_ms, max_delay_ms)
        tx_details = await db.execute(text("SELECT pg_backend_pid(), txid_current()"))
        tx_row = tx_details.first()
        logger.warning(
            "qa_booking_race_delay slot_id=%s backend_pid=%s txid=%s delay_ms=%s",
            slot_id,
            tx_row[0] if tx_row else None,
            tx_row[1] if tx_row else None,
            delay_ms,
        )
        await asyncio.sleep(delay_ms / 1000.0)

    @staticmethod
    async def _begin_transaction_if_needed(db: AsyncSession) -> None:
        if db.in_transaction():
            return

        dialect_name = db.get_bind().dialect.name
        if dialect_name == "sqlite":
            await db.execute(text("BEGIN IMMEDIATE"))
            return

        await db.begin()

    @staticmethod
    async def _enqueue_google_create_for_appointment(
        db: AsyncSession,
        appointment_id: int,
    ) -> None:
        return None

    @staticmethod
    async def _enqueue_google_delete_for_appointment(
        db: AsyncSession,
        appointment_id: int,
        google_event_id: Optional[str],
    ) -> None:
        return None

    @staticmethod
    async def _enqueue_google_update_for_appointment(
        db: AsyncSession,
        appointment_id: int,
    ) -> None:
        from api.app.services.outbox_service import OutboxService

        outbox = OutboxService(db)
        await outbox.enqueue_google_update(
            appointment_id=cast(Any, appointment_id),
            payload={
                "appointment_id": str(appointment_id),
                "action": "update",
                "entity_type": "appointment",
                "source": "slot_based",
                "idempotency_key": f"slot_based.appointment.google.update:{appointment_id}",
            },
        )
        await db.commit()

        try:
            await outbox.try_dispatch_google_update_after_commit(cast(Any, appointment_id))
        except Exception:
            logger.warning(
                "slot_based_google_update_post_commit_dispatch_failed",
                extra={"appointment_id": str(appointment_id)},
            )

    @staticmethod
    def _buffer_window(
        slot_start: datetime,
        slot_end: datetime,
        buffer_before_minutes: int,
        buffer_after_minutes: int,
    ) -> Tuple[datetime, datetime]:
        return (
            slot_start - timedelta(minutes=max(0, buffer_before_minutes)),
            slot_end + timedelta(minutes=max(0, buffer_after_minutes)),
        )

    @staticmethod
    async def _lock_slots_in_window(
        db: AsyncSession,
        doctor_id: int,
        window_start: datetime,
        window_end: datetime,
    ) -> List[TimeSlot]:
        tx_meta = await db.execute(text("SELECT pg_backend_pid(), txid_current()"))
        tx_row = tx_meta.first()
        backend_pid = int(tx_row[0]) if tx_row is not None else None
        txid = int(tx_row[1]) if tx_row is not None else None
        logger.info(
            "slot_window_lock_attempt backend_pid=%s txid=%s doctor_id=%s window_start=%s window_end=%s order=start_time_asc",
            backend_pid,
            txid,
            doctor_id,
            window_start,
            window_end,
        )

        # Lock the full buffer window first so no concurrent transaction can
        # modify any slot in the same protected range during validation/write.
        locked_id_rows = await db.execute(
            text(
                """
                SELECT id
                FROM time_slots
                WHERE doctor_id = :doctor_id
                  AND start_time >= :window_start
                  AND start_time < :window_end
                ORDER BY start_time ASC, id ASC
                FOR UPDATE
                """
            ),
            {
                "doctor_id": doctor_id,
                "window_start": window_start,
                "window_end": window_end,
            },
        )
        locked_ids = [int(row_id) for row_id in locked_id_rows.scalars().all()]
        logger.info(
            "slot_window_lock_acquired backend_pid=%s txid=%s doctor_id=%s locked_slot_ids=%s",
            backend_pid,
            txid,
            doctor_id,
            locked_ids,
        )
        if not locked_ids:
            return []

        result = await db.execute(
            select(TimeSlot)
            .where(TimeSlot.id.in_(locked_ids))
            .order_by(TimeSlot.start_time.asc(), TimeSlot.id.asc())
            .execution_options(populate_existing=True)
        )
        return list(result.scalars().all())

    @staticmethod
    async def _slot_is_buffer_blocked(
        db: AsyncSession,
        slot_id: int,
    ) -> bool:
        linked = await db.scalar(
            select(SlotBufferBlock.id)
            .where(SlotBufferBlock.blocked_slot_id == slot_id)
            .limit(1)
        )
        return linked is not None

    @staticmethod
    async def _apply_buffer_blocks(
        db: AsyncSession,
        source_slot_id: int,
        doctor_id: int,
        slot_start: datetime,
        slot_end: datetime,
        buffer_before_minutes: int,
        buffer_after_minutes: int,
    ) -> int:
        if buffer_before_minutes <= 0 and buffer_after_minutes <= 0:
            return 0

        buffer_start, buffer_end = TimeSlotService._buffer_window(
            slot_start,
            slot_end,
            buffer_before_minutes,
            buffer_after_minutes,
        )
        slots = await TimeSlotService._lock_slots_in_window(
            db=db,
            doctor_id=doctor_id,
            window_start=buffer_start,
            window_end=buffer_end,
        )

        candidate_ids = [int(slot.id) for slot in slots if int(slot.id) != source_slot_id]
        linked_blocked_ids: set[int] = set()
        if candidate_ids:
            linked_rows = await db.execute(
                select(SlotBufferBlock.blocked_slot_id)
                .where(SlotBufferBlock.blocked_slot_id.in_(candidate_ids))
            )
            linked_blocked_ids = {int(row_id) for row_id in linked_rows.scalars().all()}

        link_ids: list[int] = []
        newly_blocked = 0
        for slot in slots:
            slot_id = int(slot.id)
            if slot_id == source_slot_id:
                continue

            if str(slot.status) == "available":
                slot.status = "blocked"
                newly_blocked += 1
                link_ids.append(slot_id)
            elif str(slot.status) == "blocked" and slot_id in linked_blocked_ids:
                link_ids.append(slot_id)
            elif str(slot.status) == "blocked":
                # Under strict consistency, blocked slots should always be backed
                # by at least one link. If a slot is already blocked in-window,
                # attach this source as an active blocker.
                link_ids.append(slot_id)

        if not link_ids:
            return newly_blocked

        existing_rows = await db.execute(
            select(SlotBufferBlock.blocked_slot_id).where(
                and_(
                    SlotBufferBlock.source_slot_id == source_slot_id,
                    SlotBufferBlock.blocked_slot_id.in_(link_ids),
                )
            )
        )
        existing_ids = {int(row_id) for row_id in existing_rows.scalars().all()}
        for blocked_slot_id in link_ids:
            if blocked_slot_id in existing_ids:
                continue
            db.add(
                SlotBufferBlock(
                    source_slot_id=source_slot_id,
                    blocked_slot_id=blocked_slot_id,
                )
            )

        # Ensure subsequent SQL reconciliation sees newly added links even when
        # session autoflush is disabled in runtime configuration.
        await db.flush()

        return newly_blocked

    @staticmethod
    async def _release_buffer_blocks_for_source_slot(
        db: AsyncSession,
        source_slot_id: int,
    ) -> int:
        blocked_rows = await db.execute(
            select(SlotBufferBlock.blocked_slot_id).where(SlotBufferBlock.source_slot_id == source_slot_id)
        )
        blocked_slot_ids = [int(row_id) for row_id in blocked_rows.scalars().all()]
        if not blocked_slot_ids:
            return 0

        before_rows = await db.execute(
            select(TimeSlot.id, TimeSlot.status).where(TimeSlot.id.in_(blocked_slot_ids))
        )
        before_status = {int(row[0]): str(row[1]) for row in before_rows.all()}

        await db.execute(delete(SlotBufferBlock).where(SlotBufferBlock.source_slot_id == source_slot_id))
        await TimeSlotService._reconcile_slot_statuses(db, blocked_slot_ids)

        after_rows = await db.execute(
            select(TimeSlot.id, TimeSlot.status).where(TimeSlot.id.in_(blocked_slot_ids))
        )
        after_status = {int(row[0]): str(row[1]) for row in after_rows.all()}
        released = 0
        for slot_id in blocked_slot_ids:
            if before_status.get(slot_id) == "blocked" and after_status.get(slot_id) == "available":
                released += 1
        return released

    @staticmethod
    async def _reconcile_slot_statuses(
        db: AsyncSession,
        slot_ids: Iterable[int],
    ) -> None:
        """Keep selected slot statuses consistent with booking and buffer-link truth.

        Derived state precedence:
        - booked: slot is currently reserved
        - blocked: there is at least one SlotBufferBlock for the slot
        - available: no booking and no active SlotBufferBlock links
        """
        target_ids = sorted({int(slot_id) for slot_id in slot_ids})
        if not target_ids:
            return

        await db.execute(
            text(
                """
                                UPDATE time_slots
                SET status = 'blocked'
                                WHERE id = ANY(:slot_ids)
                                    AND status <> 'booked'
                  AND EXISTS (
                    SELECT 1
                    FROM slot_buffer_blocks sbb
                                        WHERE sbb.blocked_slot_id = time_slots.id
                  )
                """
            ),
            {"slot_ids": target_ids},
        )
        await db.execute(
            text(
                """
                                UPDATE time_slots
                SET status = 'available'
                                WHERE id = ANY(:slot_ids)
                                    AND status = 'blocked'
                  AND NOT EXISTS (
                    SELECT 1
                    FROM slot_buffer_blocks sbb
                                        WHERE sbb.blocked_slot_id = time_slots.id
                  )
                """
            ),
            {"slot_ids": target_ids},
        )

    @staticmethod
    def _has_conflicting_booked_slot(
        slots: List[TimeSlot],
        slot_id: int,
    ) -> bool:
        for slot in slots:
            if int(slot.id) == slot_id:
                continue
            if str(slot.status) == "booked":
                return True
        return False

    @staticmethod
    async def generate_daily_slots(
        db: AsyncSession,
        doctor_id: int,
        slot_date: date,
        start_hour: int = 9,
        end_hour: int = 17,
        duration_minutes: int = 30,
    ) -> Dict[str, Any]:
        """Generate slots for a doctor on a specific date.
        
        Returns:
            {
                "generated": count,
                "slots": [TimeSlot objects],
                "error": str or None
            }
        """
        try:
            slots = []
            current = datetime.combine(slot_date, time(start_hour, 0))
            end = datetime.combine(slot_date, time(end_hour, 0))

            while current < end:
                slot_end = current + timedelta(minutes=duration_minutes)
                
                if slot_end <= end:
                    # Insert with ON CONFLICT handling
                    slot = TimeSlot(
                        doctor_id=doctor_id,
                        start_time=current,
                        end_time=slot_end,
                        status="available"
                    )
                    db.add(slot)
                    slots.append(slot)
                
                current = slot_end

            await db.commit()
            logger.info(f"Generated {len(slots)} slots for doctor {doctor_id} on {slot_date}")
            
            return {
                "generated": len(slots),
                "slots": slots,
                "error": None
            }
        except Exception as e:
            await db.rollback()
            logger.error(f"Error generating slots: {e}")
            return {
                "generated": 0,
                "slots": [],
                "error": str(e)
            }

    @staticmethod
    async def get_available_slots(
        db: AsyncSession,
        doctor_id: int,
        slot_date: date,
    ) -> List[TimeSlot]:
        """Get all available slots for a doctor on a date."""
        try:
            query = select(TimeSlot).where(
                and_(
                    TimeSlot.doctor_id == doctor_id,
                    TimeSlot.status == "available",
                    TimeSlot.start_time >= datetime.combine(slot_date, time.min),
                    TimeSlot.start_time < datetime.combine(slot_date + timedelta(days=1), time.min)
                )
            ).order_by(TimeSlot.start_time)
            
            result = await db.execute(query)
            return list(result.scalars())
        except Exception as e:
            logger.error(f"Error fetching available slots: {e}")
            return []

    @staticmethod
    async def _get_doctor_buffers(
        db: AsyncSession,
        doctor_id: int,
    ) -> Tuple[int, int]:
        """Return (buffer_before_minutes, buffer_after_minutes) for a doctor.

        Backward compatibility:
        - Prefer columns in doctors table
        - Fallback to doctor_schedule_config.buffer_minutes as symmetric buffer
        """
        try:
            row = await db.execute(
                text(
                    """
                    SELECT
                        COALESCE(buffer_before_minutes, 0) AS buffer_before_minutes,
                        COALESCE(buffer_after_minutes, 0) AS buffer_after_minutes
                    FROM doctors
                    WHERE id = :doctor_id
                    LIMIT 1
                    """
                ),
                {"doctor_id": doctor_id},
            )
            data = row.first()
            if data is not None:
                return (max(0, int(data[0] or 0)), max(0, int(data[1] or 0)))
        except Exception:
            # Fallback below handles legacy schema or environments without new columns.
            pass

        value = await db.scalar(
            select(DoctorScheduleConfig.buffer_minutes).where(DoctorScheduleConfig.doctor_id == doctor_id)
        )
        legacy = max(0, int(value or 0))
        return (legacy, legacy)

    @staticmethod
    async def _get_specialty_policy(
        db: AsyncSession,
        doctor_id: int,
    ) -> Tuple[bool, int]:
        """Return (allow_urgent_reassign, urgent_sla_target_minutes) for doctor's specialty."""
        specialty = await db.scalar(select(Doctor.specialization).where(Doctor.id == doctor_id))
        if not specialty:
            return (False, 60)

        row = await db.execute(
            select(
                SpecialtyPriorityPolicy.allow_urgent_reassign,
                SpecialtyPriorityPolicy.urgent_sla_target_minutes,
            ).where(SpecialtyPriorityPolicy.specialty == specialty)
        )
        policy = row.first()
        if not policy:
            return (False, 60)

        allow_reassign = bool(policy[0])
        sla_target = int(policy[1] or 60)
        return (allow_reassign, sla_target)

    @staticmethod
    async def _block_buffer_slots(
        db: AsyncSession,
        doctor_id: int,
        slot_start: datetime,
        slot_end: datetime,
        buffer_before_minutes: int,
        buffer_after_minutes: int,
    ) -> int:
        """Block available adjacent slots inside doctor buffer window."""
        source_slot_id = await db.scalar(
            select(TimeSlot.id).where(
                and_(
                    TimeSlot.doctor_id == doctor_id,
                    TimeSlot.start_time == slot_start,
                    TimeSlot.end_time == slot_end,
                    TimeSlot.status == "booked",
                )
            )
        )
        if source_slot_id is None:
            return 0

        return await TimeSlotService._apply_buffer_blocks(
            db=db,
            source_slot_id=int(source_slot_id),
            doctor_id=doctor_id,
            slot_start=slot_start,
            slot_end=slot_end,
            buffer_before_minutes=buffer_before_minutes,
            buffer_after_minutes=buffer_after_minutes,
        )

    @staticmethod
    async def _release_buffer_slots(
        db: AsyncSession,
        doctor_id: int,
        released_slot_id: int,
        released_start: datetime,
        released_end: datetime,
        buffer_before_minutes: int,
        buffer_after_minutes: int,
    ) -> int:
        """Release blocked slots only when no other active appointment still needs them."""
        return await TimeSlotService._release_buffer_blocks_for_source_slot(
            db=db,
            source_slot_id=released_slot_id,
        )

    @staticmethod
    async def _book_slot_in_transaction(
        db: AsyncSession,
        slot_id: int,
        patient_id: int,
        priority: str = "normal",
    ) -> Tuple[bool, Optional[int], str]:
        slot_row = (
            await db.execute(
                text(
                    """
                    SELECT id, doctor_id, start_time, end_time
                    FROM time_slots
                    WHERE id = :slot_id
                    LIMIT 1
                    """
                ),
                {"slot_id": slot_id},
            )
        ).first()
        if slot_row is None:
            return (False, None, "Slot not found")

        doctor_id = int(slot_row[1])
        slot_start = slot_row[2]
        slot_end = slot_row[3]

        buffer_before_minutes, buffer_after_minutes = await TimeSlotService._get_doctor_buffers(db, doctor_id)
        buffer_start, buffer_end = TimeSlotService._buffer_window(
            slot_start,
            slot_end,
            buffer_before_minutes,
            buffer_after_minutes,
        )
        locked_slots = await TimeSlotService._lock_slots_in_window(
            db=db,
            doctor_id=doctor_id,
            window_start=buffer_start,
            window_end=buffer_end,
        )
        slot = next((row for row in locked_slots if int(row.id) == slot_id), None)
        if slot is None:
            return (False, None, "Slot not found")

        slot_status = str(slot.status)
        if priority == "normal":
            if slot_status != "available":
                return (False, None, "Slot not available or already booked")
            if TimeSlotService._has_conflicting_booked_slot(locked_slots, slot_id):
                return (False, None, "Slot conflicts with an adjacent booking buffer")
        else:
            if slot_status == "blocked":
                is_buffer_blocked = await TimeSlotService._slot_is_buffer_blocked(db, slot_id)
                if not is_buffer_blocked:
                    return (False, None, "Slot blocked by existing non-buffer rule")
            elif slot_status != "available":
                return (False, None, "Slot not available or already booked")

        await TimeSlotService._maybe_inject_booking_race_delay(db, slot_id)

        expected_status = slot_status
        update_result = await db.execute(
            update(TimeSlot)
            .where(
                and_(
                    TimeSlot.id == slot_id,
                    TimeSlot.status == expected_status,
                )
            )
            .values(
                status="booked",
                priority_override="urgent" if priority == "urgent" else None,
            )
        )
        if int(update_result.rowcount or 0) != 1:
            return (False, None, "Slot not available or already booked")

        resources_ok, resource_error, required_count, booked_count = await TimeSlotService._reserve_required_resources_for_slot(
            db=db,
            slot_id=slot_id,
            slot_start=slot.start_time,
            slot_end=slot.end_time,
        )
        if not resources_ok:
            logger.warning(
                "Resource conflict booking slot %s: required=%s booked=%s",
                slot_id,
                required_count,
                booked_count,
            )
            return (False, None, resource_error)

        blocked_count = await TimeSlotService._apply_buffer_blocks(
            db=db,
            source_slot_id=slot_id,
            doctor_id=slot.doctor_id,
            slot_start=slot.start_time,
            slot_end=slot.end_time,
            buffer_before_minutes=buffer_before_minutes,
            buffer_after_minutes=buffer_after_minutes,
        )

        appointment = Appointment(
            slot_id=slot_id,
            patient_id=patient_id,
            status="scheduled",
            priority=priority,
        )
        db.add(appointment)
        await db.flush()
        appointment_id = int(appointment.id)

        logger.info(
            "Booked slot %s for patient %s, appointment %s, priority=%s, buffer=%s, blocked=%s",
            slot_id,
            patient_id,
            appointment_id,
            priority,
            f"{buffer_before_minutes}/{buffer_after_minutes}",
            blocked_count,
        )
        return (True, appointment_id, "")

    @staticmethod
    async def _reserve_required_resources_for_slot(
        db: AsyncSession,
        slot_id: int,
        slot_start: datetime,
        slot_end: datetime,
    ) -> Tuple[bool, str, int, int]:
        """Atomically reserve all resources required by slot; fail if any is unavailable."""
        row = (
            await db.execute(
                text(
                    """
                    WITH req AS (
                        SELECT resource_id
                        FROM slot_resource_requirements
                        WHERE slot_id = :slot_id
                    ),
                    upd AS (
                        UPDATE resource_slots rs
                        SET status = 'booked'
                        FROM req
                        WHERE rs.resource_id = req.resource_id
                          AND rs.start_time = :slot_start
                          AND rs.end_time = :slot_end
                          AND rs.status = 'available'
                        RETURNING rs.resource_id
                    )
                    SELECT
                        (SELECT COUNT(*) FROM req) AS required_count,
                        (SELECT COUNT(*) FROM upd) AS booked_count
                    """
                ),
                {
                    "slot_id": slot_id,
                    "slot_start": slot_start,
                    "slot_end": slot_end,
                },
            )
        ).first()

        required_count = int((row[0] if row is not None else 0) or 0)
        booked_count = int((row[1] if row is not None else 0) or 0)

        if required_count == 0:
            return (True, "", 0, 0)

        if booked_count != required_count:
            return (
                False,
                "Required resources are not fully available for this slot",
                required_count,
                booked_count,
            )

        return (True, "", required_count, booked_count)

    @staticmethod
    async def _release_required_resources_for_slot(
        db: AsyncSession,
        slot_id: int,
        slot_start: datetime,
        slot_end: datetime,
    ) -> int:
        """Release booked resource slots linked to a cancelled appointment slot."""
        result = await db.execute(
            text(
                """
                UPDATE resource_slots
                SET status = 'available'
                WHERE status = 'booked'
                  AND start_time = :slot_start
                  AND end_time = :slot_end
                  AND resource_id IN (
                    SELECT resource_id
                    FROM slot_resource_requirements
                    WHERE slot_id = :slot_id
                  )
                """
            ),
            {
                "slot_id": slot_id,
                "slot_start": slot_start,
                "slot_end": slot_end,
            },
        )
        return int(result.rowcount or 0)

    @staticmethod
    async def book_slot(
        db: AsyncSession,
        slot_id: int,
        patient_id: int,
        priority: str = "normal",
        allow_reassign: bool = False,
        displaced_by_user_id: Optional[int] = None,
        reassignment_reason: Optional[str] = None,
    ) -> Tuple[bool, Optional[int], str]:
        """Book a slot atomically.
        
        Critical: UPDATE without prior SELECT prevents race conditions.
        
        Priority flow:
        - normal: only available slots
        - urgent: available -> blocked -> reassign (optional)

        Returns:
            (success: bool, appointment_id: int or None, error_message: str)
        """
        try:
            if priority not in ("normal", "urgent"):
                return (False, None, "Invalid priority. Use 'normal' or 'urgent'")

            await TimeSlotService._begin_transaction_if_needed(db)

            success, appointment_id, error = await TimeSlotService._book_slot_in_transaction(
                db=db,
                slot_id=slot_id,
                patient_id=patient_id,
                priority=priority,
            )
            if not success:
                await db.rollback()
                if priority == "urgent" and allow_reassign:
                    reassign_ok, reassign_appointment_id, reassign_error = await TimeSlotService._reassign_for_urgent(
                        db=db,
                        desired_slot_id=slot_id,
                        urgent_patient_id=patient_id,
                        displaced_by_user_id=displaced_by_user_id,
                        reason=reassignment_reason,
                    )
                    if reassign_ok:
                        await db.commit()
                        return (True, reassign_appointment_id, "")
                    await db.rollback()
                    return (False, None, reassign_error)
                return (False, None, error)

            booked_slot = await db.scalar(select(TimeSlot).where(TimeSlot.id == slot_id))
            affected_slot_ids = [slot_id]
            if booked_slot is not None:
                buffer_before_minutes, buffer_after_minutes = await TimeSlotService._get_doctor_buffers(
                    db,
                    booked_slot.doctor_id,
                )
                window_start, window_end = TimeSlotService._buffer_window(
                    booked_slot.start_time,
                    booked_slot.end_time,
                    buffer_before_minutes,
                    buffer_after_minutes,
                )
                affected_rows = await db.execute(
                    select(TimeSlot.id).where(
                        and_(
                            TimeSlot.doctor_id == booked_slot.doctor_id,
                            TimeSlot.start_time >= window_start,
                            TimeSlot.start_time < window_end,
                        )
                    )
                )
                affected_slot_ids = [int(value) for value in affected_rows.scalars().all()]

            await TimeSlotService._reconcile_slot_statuses(db, affected_slot_ids)
            await db.commit()

            try:
                await TimeSlotService._enqueue_google_create_for_appointment(
                    db=db,
                    appointment_id=appointment_id,
                )
            except Exception as exc:
                logger.warning(
                    "slot_based_google_create_enqueue_failed appointment_id=%s error=%s",
                    appointment_id,
                    exc,
                )

            return (True, appointment_id, "")
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Error booking slot: {e}")
            return (False, None, str(e))

    @staticmethod
    async def _reassign_for_urgent(
        db: AsyncSession,
        desired_slot_id: int,
        urgent_patient_id: int,
        displaced_by_user_id: Optional[int],
        reason: Optional[str],
    ) -> Tuple[bool, Optional[int], str]:
        """Reassign a future normal appointment to make room for an urgent case."""
        if displaced_by_user_id is None:
            return (False, None, "displaced_by_user_id is required for reassignment")

        desired_slot = await db.scalar(
            select(TimeSlot).where(TimeSlot.id == desired_slot_id).with_for_update()
        )
        if desired_slot is None:
            return (False, None, "Desired slot not found")

        if desired_slot.start_time <= datetime.utcnow():
            return (False, None, "Reassignment only allowed for future appointments")

        policy_allow_reassign, sla_target_minutes = await TimeSlotService._get_specialty_policy(db, desired_slot.doctor_id)
        if not policy_allow_reassign:
            return (False, None, "Urgent reassignment is disabled for this specialty")

        if desired_slot.status != "booked":
            return (False, None, "Reassignment requires a booked slot")

        displaced_appt = await db.scalar(
            select(Appointment).where(Appointment.slot_id == desired_slot_id).with_for_update()
        )
        if displaced_appt is None:
            return (False, None, "Booked slot has no appointment")

        if displaced_appt.priority == "urgent":
            return (False, None, "Cannot displace an urgent appointment")

        replacement_slot = await db.scalar(
            select(TimeSlot)
            .where(
                and_(
                    TimeSlot.doctor_id == desired_slot.doctor_id,
                    TimeSlot.start_time > desired_slot.start_time,
                    TimeSlot.status == "available",
                )
            )
            .order_by(TimeSlot.start_time.asc())
            .limit(1)
            .with_for_update(skip_locked=True)
        )

        if replacement_slot is None:
            return (False, None, "No future slot available for reassignment")

        resources_ok, resource_error, _, _ = await TimeSlotService._reserve_required_resources_for_slot(
            db=db,
            slot_id=replacement_slot.id,
            slot_start=replacement_slot.start_time,
            slot_end=replacement_slot.end_time,
        )
        if not resources_ok:
            return (False, None, f"Reassignment failed due to resource conflict: {resource_error}")

        old_slot_id = desired_slot.id
        new_slot_id = replacement_slot.id

        buffer_before_minutes, buffer_after_minutes = await TimeSlotService._get_doctor_buffers(db, desired_slot.doctor_id)
        replacement_slot.status = "booked"
        replacement_slot.priority_override = None

        # Move displaced appointment.
        displaced_appt.slot_id = new_slot_id

        # Place urgent appointment in desired slot.
        urgent_appt = Appointment(
            slot_id=old_slot_id,
            patient_id=urgent_patient_id,
            status="scheduled",
            priority="urgent",
        )
        db.add(urgent_appt)

        desired_slot.status = "booked"
        desired_slot.priority_override = "urgent"

        await TimeSlotService._apply_buffer_blocks(
            db=db,
            source_slot_id=new_slot_id,
            doctor_id=desired_slot.doctor_id,
            slot_start=replacement_slot.start_time,
            slot_end=replacement_slot.end_time,
            buffer_before_minutes=buffer_before_minutes,
            buffer_after_minutes=buffer_after_minutes,
        )
        await TimeSlotService._reconcile_slot_statuses(
            db,
            [old_slot_id, new_slot_id],
        )

        # Flush to populate urgent_appt.id before audit insert.
        await db.flush()

        urgent_wait_minutes = max(0, int((desired_slot.start_time - datetime.utcnow()).total_seconds() // 60))
        sla_breached = urgent_wait_minutes > sla_target_minutes

        db.add(
            AppointmentReassignmentAudit(
                doctor_id=desired_slot.doctor_id,
                displaced_appointment_id=displaced_appt.id,
                urgent_appointment_id=urgent_appt.id,
                old_slot_id=old_slot_id,
                new_slot_id=new_slot_id,
                displaced_by_user_id=displaced_by_user_id,
                reason=reason,
                urgent_wait_minutes=urgent_wait_minutes,
                sla_target_minutes=sla_target_minutes,
                sla_breached=sla_breached,
            )
        )

        return (True, urgent_appt.id, "")

    @staticmethod
    async def reschedule_appointment(
        db: AsyncSession,
        appointment_id: int,
        new_slot_id: int,
    ) -> Tuple[bool, Optional[int], str]:
        """Move an appointment to a new slot atomically.

        Guarantees:
        - releases old buffers tied to the old slot only
        - applies new buffers for the new slot
        - preserves admin/manual blocked slots
        """
        try:
            await TimeSlotService._begin_transaction_if_needed(db)

            appointment = await db.scalar(
                select(Appointment).where(Appointment.id == appointment_id).with_for_update()
            )
            if appointment is None:
                await db.rollback()
                return (False, None, "Appointment not found")

            current_slot = await db.scalar(
                select(TimeSlot).where(TimeSlot.id == appointment.slot_id).with_for_update()
            )
            if current_slot is None:
                await db.rollback()
                return (False, None, "Current slot not found")

            if int(current_slot.id) == new_slot_id:
                await db.rollback()
                return (True, int(current_slot.id), "")

            new_slot = await db.scalar(
                select(TimeSlot).where(TimeSlot.id == new_slot_id).with_for_update()
            )
            if new_slot is None:
                await db.rollback()
                return (False, None, "New slot not found")

            old_before, old_after = await TimeSlotService._get_doctor_buffers(db, current_slot.doctor_id)
            new_before, new_after = await TimeSlotService._get_doctor_buffers(db, new_slot.doctor_id)

            windows = [
                (current_slot.doctor_id, *TimeSlotService._buffer_window(current_slot.start_time, current_slot.end_time, old_before, old_after)),
                (new_slot.doctor_id, *TimeSlotService._buffer_window(new_slot.start_time, new_slot.end_time, new_before, new_after)),
            ]
            affected_slot_ids: set[int] = {int(current_slot.id), int(new_slot.id)}
            for doctor_id, window_start, window_end in sorted(windows, key=lambda item: (item[0], item[1], item[2])):
                locked_window_slots = await TimeSlotService._lock_slots_in_window(
                    db=db,
                    doctor_id=doctor_id,
                    window_start=window_start,
                    window_end=window_end,
                )
                affected_slot_ids.update(int(slot.id) for slot in locked_window_slots)

            if str(new_slot.status) != "available":
                await db.rollback()
                return (False, None, "New slot not available or already booked")

            new_window_slots = await TimeSlotService._lock_slots_in_window(
                db=db,
                doctor_id=new_slot.doctor_id,
                window_start=windows[1][1],
                window_end=windows[1][2],
            )
            if TimeSlotService._has_conflicting_booked_slot(new_window_slots, new_slot_id):
                await db.rollback()
                return (False, None, "New slot conflicts with an adjacent booking buffer")

            await TimeSlotService._release_required_resources_for_slot(
                db=db,
                slot_id=current_slot.id,
                slot_start=current_slot.start_time,
                slot_end=current_slot.end_time,
            )
            current_slot.status = "available"
            current_slot.priority_override = None
            await TimeSlotService._release_buffer_blocks_for_source_slot(
                db=db,
                source_slot_id=current_slot.id,
            )

            resources_ok, resource_error, _, _ = await TimeSlotService._reserve_required_resources_for_slot(
                db=db,
                slot_id=new_slot.id,
                slot_start=new_slot.start_time,
                slot_end=new_slot.end_time,
            )
            if not resources_ok:
                await db.rollback()
                return (False, None, resource_error)

            new_slot.status = "booked"
            new_slot.priority_override = "urgent" if appointment.priority == "urgent" else None
            appointment.slot_id = new_slot.id

            await TimeSlotService._apply_buffer_blocks(
                db=db,
                source_slot_id=new_slot.id,
                doctor_id=new_slot.doctor_id,
                slot_start=new_slot.start_time,
                slot_end=new_slot.end_time,
                buffer_before_minutes=new_before,
                buffer_after_minutes=new_after,
            )

            await TimeSlotService._reconcile_slot_statuses(db, affected_slot_ids)
            await db.commit()

            try:
                await TimeSlotService._enqueue_google_update_for_appointment(
                    db=db,
                    appointment_id=appointment_id,
                )
            except Exception as exc:
                logger.warning(
                    "slot_based_google_update_enqueue_failed appointment_id=%s error=%s",
                    appointment_id,
                    exc,
                )

            return (True, int(new_slot.id), "")
        except Exception as e:
            await db.rollback()
            logger.error(f"Error rescheduling appointment: {e}")
            return (False, None, str(e))

    @staticmethod
    async def find_best_slot_for_priority(
        db: AsyncSession,
        doctor_id: int,
        slot_date: date,
        priority: str,
        allow_reassign: bool = False,
    ) -> Dict[str, Optional[int]]:
        """Find best slot candidate according to priority policy."""
        if priority not in ("normal", "urgent"):
            return {"slot_id": None, "source": None}

        start_dt = datetime.combine(slot_date, time.min)
        end_dt = datetime.combine(slot_date + timedelta(days=1), time.min)

        available_slot = await db.scalar(
            select(TimeSlot.id)
            .where(
                and_(
                    TimeSlot.doctor_id == doctor_id,
                    TimeSlot.start_time >= start_dt,
                    TimeSlot.start_time < end_dt,
                    TimeSlot.status == "available",
                )
            )
            .order_by(TimeSlot.start_time.asc())
            .limit(1)
        )
        if available_slot is not None:
            return {"slot_id": int(available_slot), "source": "available"}

        if priority == "urgent":
            blocked_slot = await db.scalar(
                select(TimeSlot.id)
                .join(SlotBufferBlock, SlotBufferBlock.blocked_slot_id == TimeSlot.id)
                .where(
                    and_(
                        TimeSlot.doctor_id == doctor_id,
                        TimeSlot.start_time >= start_dt,
                        TimeSlot.start_time < end_dt,
                        TimeSlot.status == "blocked",
                    )
                )
                .distinct()
                .order_by(TimeSlot.start_time.asc())
                .limit(1)
            )
            if blocked_slot is not None:
                return {"slot_id": int(blocked_slot), "source": "blocked"}

            policy_allow_reassign, _ = await TimeSlotService._get_specialty_policy(db, doctor_id)
            if allow_reassign and policy_allow_reassign:
                booked_slot = await db.scalar(
                    select(TimeSlot.id)
                    .join(Appointment, Appointment.slot_id == TimeSlot.id)
                    .where(
                        and_(
                            TimeSlot.doctor_id == doctor_id,
                            TimeSlot.start_time >= start_dt,
                            TimeSlot.start_time < end_dt,
                            TimeSlot.start_time > datetime.utcnow(),
                            TimeSlot.status == "booked",
                            Appointment.priority == "normal",
                            Appointment.status == "scheduled",
                        )
                    )
                    .order_by(TimeSlot.start_time.asc())
                    .limit(1)
                )
                if booked_slot is not None:
                    return {"slot_id": int(booked_slot), "source": "reassign"}

        return {"slot_id": None, "source": None}

    @staticmethod
    async def get_reassignment_audit(
        db: AsyncSession,
        doctor_id: int,
        limit: int = 50,
    ) -> List[AppointmentReassignmentAudit]:
        """Return latest reassignment records for compliance and traceability."""
        result = await db.execute(
            select(AppointmentReassignmentAudit)
            .where(AppointmentReassignmentAudit.doctor_id == doctor_id)
            .order_by(AppointmentReassignmentAudit.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars())

    @staticmethod
    async def get_urgent_sla_metrics(
        db: AsyncSession,
        doctor_id: int,
        days: int = 30,
    ) -> Dict[str, Any]:
        """Return urgent SLA and displacement percentage for a doctor."""
        from_dt = datetime.utcnow() - timedelta(days=max(1, days))

        urgent_total = int(
            await db.scalar(
                select(func.count(Appointment.id))
                .join(TimeSlot, TimeSlot.id == Appointment.slot_id)
                .where(
                    and_(
                        TimeSlot.doctor_id == doctor_id,
                        Appointment.priority == "urgent",
                        Appointment.created_at >= from_dt,
                    )
                )
            )
            or 0
        )

        displaced_total = int(
            await db.scalar(
                select(func.count(AppointmentReassignmentAudit.id)).where(
                    and_(
                        AppointmentReassignmentAudit.doctor_id == doctor_id,
                        AppointmentReassignmentAudit.created_at >= from_dt,
                    )
                )
            )
            or 0
        )

        avg_wait = await db.scalar(
            select(func.avg(AppointmentReassignmentAudit.urgent_wait_minutes)).where(
                and_(
                    AppointmentReassignmentAudit.doctor_id == doctor_id,
                    AppointmentReassignmentAudit.created_at >= from_dt,
                    AppointmentReassignmentAudit.urgent_wait_minutes.isnot(None),
                )
            )
        )

        displacement_rate = round((displaced_total / urgent_total * 100), 2) if urgent_total > 0 else 0.0

        return {
            "doctor_id": doctor_id,
            "window_days": max(1, days),
            "urgent_total": urgent_total,
            "displaced_total": displaced_total,
            "displacement_rate_percent": displacement_rate,
            "avg_urgent_wait_minutes": round(float(avg_wait), 2) if avg_wait is not None else None,
        }

    @staticmethod
    async def book_next_by_priority(
        db: AsyncSession,
        doctor_id: int,
        slot_date: date,
        patient_id: int,
        priority: str,
        allow_reassign: bool,
        displaced_by_user_id: Optional[int] = None,
        reassignment_reason: Optional[str] = None,
    ) -> Tuple[bool, Optional[int], Optional[int], str, Optional[str]]:
        """Book first suitable slot for given priority policy.

        Returns:
            (success, appointment_id, slot_id, source, error)
        """
        best = await TimeSlotService.find_best_slot_for_priority(
            db=db,
            doctor_id=doctor_id,
            slot_date=slot_date,
            priority=priority,
            allow_reassign=allow_reassign,
        )

        slot_id = best.get("slot_id")
        source = best.get("source")
        if slot_id is None:
            return (False, None, None, "none", "No slot available for selected policy")

        success, appointment_id, error = await TimeSlotService.book_slot(
            db=db,
            slot_id=slot_id,
            patient_id=patient_id,
            priority=priority,
            allow_reassign=allow_reassign,
            displaced_by_user_id=displaced_by_user_id,
            reassignment_reason=reassignment_reason,
        )

        return (success, appointment_id, slot_id, source, error)

    @staticmethod
    async def cancel_appointment(
        db: AsyncSession,
        appointment_id: int
    ) -> Tuple[bool, Optional[int], str]:
        """Cancel an appointment and release the slot.
        
        Returns:
            (success: bool, slot_id: int or None, error: str)
        """
        try:
            await TimeSlotService._begin_transaction_if_needed(db)

            # Get appointment
            query = select(Appointment).where(Appointment.id == appointment_id).with_for_update()
            result = await db.execute(query)
            appointment = result.scalar_one_or_none()
            
            if not appointment:
                return (False, None, "Appointment not found")
            
            slot = await db.scalar(
                select(TimeSlot).where(TimeSlot.id == appointment.slot_id).with_for_update()
            )
            if slot is None:
                return (False, None, "Slot not found")

            buffer_before_minutes, buffer_after_minutes = await TimeSlotService._get_doctor_buffers(
                db,
                slot.doctor_id,
            )
            google_event_id = appointment.google_event_id
            
            # 1) Release main slot back to available.
            await db.execute(
                update(TimeSlot)
                .where(TimeSlot.id == appointment.slot_id)
                .values(status="available")
            )

            # 2) Delete appointment row (slot booking no longer active).
            await db.execute(
                delete(Appointment).where(Appointment.id == appointment_id)
            )

            released_resources = await TimeSlotService._release_required_resources_for_slot(
                db=db,
                slot_id=slot.id,
                slot_start=slot.start_time,
                slot_end=slot.end_time,
            )

            unblocked_count = await TimeSlotService._release_buffer_slots(
                db=db,
                doctor_id=slot.doctor_id,
                released_slot_id=slot.id,
                released_start=slot.start_time,
                released_end=slot.end_time,
                buffer_before_minutes=buffer_before_minutes,
                buffer_after_minutes=buffer_after_minutes,
            )

            await TimeSlotService._reconcile_slot_statuses(db, [int(slot.id)])
            await db.commit()

            try:
                await TimeSlotService._enqueue_google_delete_for_appointment(
                    db=db,
                    appointment_id=appointment_id,
                    google_event_id=google_event_id,
                )
            except Exception as exc:
                logger.warning(
                    "slot_based_google_delete_enqueue_failed appointment_id=%s error=%s",
                    appointment_id,
                    exc,
                )

            logger.info(
                "Cancelled appointment %s (deleted), released slot %s, resources=%s, buffer=%s, unblocked=%s",
                appointment_id,
                appointment.slot_id,
                released_resources,
                f"{buffer_before_minutes}/{buffer_after_minutes}",
                unblocked_count,
            )
            return (True, appointment.slot_id, "")  # type: ignore
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Error cancelling appointment: {e}")
            return (False, None, str(e))

    @staticmethod


    async def get_doctor_utilization(
        db: AsyncSession,
        doctor_id: int,
        slot_date: date,
    ) -> Dict[str, Any]:  # Return type includes Any for utilization_rate float
        """Get slot utilization stats for a doctor on a date."""
        try:
            # Count slots by status
            query = select(TimeSlot.status).where(
                and_(
                    TimeSlot.doctor_id == doctor_id,
                    TimeSlot.start_time >= datetime.combine(slot_date, time.min),
                    TimeSlot.start_time < datetime.combine(slot_date + timedelta(days=1), time.min)
                )
            )
            
            result = await db.execute(query)
            statuses = result.scalars().all()
            
            total = len(statuses)
            booked = sum(1 for s in statuses if s == "booked")
            available = sum(1 for s in statuses if s == "available")
            blocked = sum(1 for s in statuses if s == "blocked")
            
            return {
                "total": total,
                "booked": booked,
                "available": available,
                "blocked": blocked,
                "utilization_rate": (booked / total * 100) if total > 0 else 0
            }
        except Exception as e:
            logger.error(f"Error getting utilization: {e}")
            return {"total": 0, "booked": 0, "available": 0, "blocked": 0, "utilization_rate": 0.0}

