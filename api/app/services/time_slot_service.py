"""
Time Slot Management Service

Handles slot generation, availability checking, booking, and cancellation.
Implements the business logic for the slot-based appointment model.
"""

import logging
from datetime import datetime, date, timedelta, time as time_type
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import and_, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.app.models.time_slot_models import (
    TimeSlot,
    SlotStatusEnum,
    AppointmentV2,
    AppointmentStatusEnum,
    DoctorScheduleConfig,
    SlotAuditLog,
)
from api.app.schemas.appointments import AppointmentCreate, AppointmentResponse
from core.exceptions import BusinessLogicError
from core.response.execution_adapter import ExecutionResponse

logger = logging.getLogger(__name__)


class TimeSlotService:
    """
    Service for time slot management with focus on:
    - Zero overlaps (guaranteed by slot model)
    - Atomic booking transactions
    - Scalable availability queries
    - Audit trail for compliance
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    # ========== SLOT GENERATION ==========

    async def generate_daily_slots(
        self,
        doctor_id: UUID,
        slot_date: date,
        duration_minutes: int = 30,
    ) -> List[TimeSlot]:
        """
        Generate slots for a doctor on a specific date.

        Uses the database function generate_daily_slots_for_doctor() for atomic
        generation and deduplication (won't create if slots already exist).

        Args:
            doctor_id: Doctor UUID
            slot_date: Date to generate slots for
            duration_minutes: Slot duration (15, 30, 45, 60, 90, 120)

        Returns:
            List of created TimeSlot objects

        Raises:
            BusinessLogicError: If doctor doesn't have schedule config for that day
        """
        logger.info(f"Generating {duration_minutes}min slots for doctor {doctor_id} on {slot_date}")

        try:
            # Call PostgreSQL stored procedure
            result = await self.db.execute(
                text("""
                SELECT * FROM generate_daily_slots_for_doctor(:doctor_id, :slot_date, :duration)
                """),
                {
                    "doctor_id": str(doctor_id),
                    "slot_date": slot_date,
                    "duration": duration_minutes,
                }
            )

            rows = result.fetchall()
            logger.info(f"Generated {len(rows)} slots for doctor {doctor_id} on {slot_date}")
            
            # Fetch the created slots from database
            slots = await self.db.execute(
                select(TimeSlot).where(
                    and_(
                        TimeSlot.doctor_id == doctor_id,
                        TimeSlot.slot_date == slot_date,
                        TimeSlot.slot_status == SlotStatusEnum.AVAILABLE,
                    )
                )
            )
            
            return slots.scalars().all()

        except Exception as e:
            logger.error(f"Failed to generate slots: {str(e)}")
            raise BusinessLogicError(f"Slot generation failed: {str(e)}")

    async def generate_slots_batch(
        self,
        doctor_id: UUID,
        start_date: date,
        num_days: int = 30,
        duration_minutes: int = 30,
    ) -> dict:
        """
        Generate slots for multiple consecutive days.

        Useful for bulk initialization or recurring schedule updates.

        Args:
            doctor_id: Doctor UUID
            start_date: First date to generate
            num_days: Number of consecutive days
            duration_minutes: Slot duration

        Returns:
            Dict with generated/skipped day counts
        """
        logger.info(f"Batch generating {num_days} days of slots for doctor {doctor_id}")
        
        stats = {"generated": 0, "skipped": 0, "errors": 0}
        
        for i in range(num_days):
            current_date = start_date + timedelta(days=i)
            try:
                slots = await self.generate_daily_slots(doctor_id, current_date, duration_minutes)
                if slots:
                    stats["generated"] += 1
                else:
                    stats["skipped"] += 1
            except Exception as e:
                logger.warning(f"Failed to generate slots for {current_date}: {str(e)}")
                stats["errors"] += 1
        
        logger.info(f"Batch generation completed: {stats}")
        return stats

    # ========== AVAILABILITY QUERIES ==========

    async def get_available_slots(
        self,
        doctor_id: UUID,
        slot_date: date,
        duration_minutes: Optional[int] = None,
    ) -> List[TimeSlot]:
        """
        Get all available slots for a doctor on a specific date.

        This is a fast query because:
        - Indexed on (doctor_id, slot_date, slot_status)
        - Returns only 'available' slots
        - No joins needed

        Args:
            doctor_id: Doctor UUID
            slot_date: Date to check
            duration_minutes: Filter by duration (optional)

        Returns:
            List of available TimeSlot objects sorted by time
        """
        query = select(TimeSlot).where(
            and_(
                TimeSlot.doctor_id == doctor_id,
                TimeSlot.slot_date == slot_date,
                TimeSlot.slot_status == SlotStatusEnum.AVAILABLE,
                TimeSlot.is_deleted == False,
            )
        )
        
        if duration_minutes:
            query = query.where(TimeSlot.slot_duration_minutes == duration_minutes)
        
        # Sort by start time
        query = query.order_by(TimeSlot.slot_start_time)
        
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_available_slots_range(
        self,
        doctor_id: UUID,
        start_date: date,
        end_date: date,
        duration_minutes: Optional[int] = None,
    ) -> List[TimeSlot]:
        """
        Get available slots across a date range.

        Useful for calendar views showing next 7 days, etc.

        Args:
            doctor_id: Doctor UUID
            start_date: Range start
            end_date: Range end (inclusive)
            duration_minutes: Filter by duration

        Returns:
            List of available slots sorted by date and time
        """
        query = select(TimeSlot).where(
            and_(
                TimeSlot.doctor_id == doctor_id,
                TimeSlot.slot_date >= start_date,
                TimeSlot.slot_date <= end_date,
                TimeSlot.slot_status == SlotStatusEnum.AVAILABLE,
                TimeSlot.is_deleted == False,
            )
        )
        
        if duration_minutes:
            query = query.where(TimeSlot.slot_duration_minutes == duration_minutes)
        
        # Sort by date and time
        query = query.order_by(TimeSlot.slot_date, TimeSlot.slot_start_time)
        
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_doctor_utilization(
        self,
        doctor_id: UUID,
        slot_date: date,
    ) -> dict:
        """
        Get slot utilization metrics for a doctor on a date.

        Returns:
            Dict with total/booked/available/blocked/cancelled counts
        """
        query = select(
            TimeSlot.slot_status,
            text("COUNT(*) as count")
        ).where(
            and_(
                TimeSlot.doctor_id == doctor_id,
                TimeSlot.slot_date == slot_date,
                TimeSlot.is_deleted == False,
            )
        ).group_by(TimeSlot.slot_status)
        
        result = await self.db.execute(query)
        rows = result.all()
        
        stats = {
            "total": 0,
            "available": 0,
            "booked": 0,
            "blocked": 0,
            "cancelled": 0,
        }
        
        for status, count in rows:
            stats[status.value] += count
            stats["total"] += count
        
        return stats

    # ========== BOOKINGS ==========

    async def book_slot(
        self,
        slot_id: UUID,
        patient_id: UUID,
        appointment_notes: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> Tuple[bool, Optional[UUID], Optional[str]]:
        """
        Book a slot for a patient (atomic operation).

        Uses PostgreSQL stored procedure check_and_book_slot() for:
        - Atomic slot status verification and update
        - Automatic appointment creation
        - Audit logging

        Args:
            slot_id: Slot UUID
            patient_id: Patient UUID
            appointment_notes: Optional notes
            idempotency_key: For request deduplication

        Returns:
            Tuple of (success: bool, appointment_id: UUID, error_code: str)
            - (True, appointment_id, None) on success
            - (False, None, error_code) on failure
        """
        logger.info(f"Booking slot {slot_id} for patient {patient_id}")

        try:
            result = await self.db.execute(
                text("""
                SELECT * FROM check_and_book_slot(:slot_id, :patient_id, :notes, :idemp_key)
                """),
                {
                    "slot_id": str(slot_id),
                    "patient_id": str(patient_id),
                    "notes": appointment_notes,
                    "idemp_key": idempotency_key,
                }
            )

            row = result.first()
            success, appointment_id, error_code = row
            
            if success:
                logger.info(f"Slot {slot_id} booked successfully (appointment {appointment_id})")
                await self.db.commit()
            else:
                logger.warning(f"Failed to book slot {slot_id}: {error_code}")
                await self.db.rollback()
            
            return success, appointment_id, error_code

        except Exception as e:
            logger.error(f"Error booking slot: {str(e)}")
            await self.db.rollback()
            return False, None, "INTERNAL_ERROR"

    # ========== CANCELLATIONS ==========

    async def cancel_appointment(
        self,
        appointment_id: UUID,
        cancellation_reason: Optional[str] = None,
        cancelled_by_user_id: Optional[UUID] = None,
    ) -> Tuple[bool, Optional[UUID], Optional[str]]:
        """
        Cancel an appointment and release its slot.

        Uses PostgreSQL stored procedure cancel_appointment_and_release_slot() for:
        - Atomic appointment status update
        - Slot release back to available
        - Audit logging with reason

        Args:
            appointment_id: Appointment UUID
            cancellation_reason: Reason for cancellation
            cancelled_by_user_id: Who cancelled (system if None)

        Returns:
            Tuple of (success: bool, slot_id: UUID, error_code: str)
        """
        logger.info(f"Cancelling appointment {appointment_id}")

        try:
            result = await self.db.execute(
                text("""
                SELECT * FROM cancel_appointment_and_release_slot(:appt_id, :reason, :user_id)
                """),
                {
                    "appt_id": str(appointment_id),
                    "reason": cancellation_reason,
                    "user_id": str(cancelled_by_user_id) if cancelled_by_user_id else None,
                }
            )

            row = result.first()
            success, slot_id, error_code = row
            
            if success:
                logger.info(f"Appointment {appointment_id} cancelled (slot {slot_id} released)")
                await self.db.commit()
            else:
                logger.warning(f"Failed to cancel appointment {appointment_id}: {error_code}")
                await self.db.rollback()
            
            return success, slot_id, error_code

        except Exception as e:
            logger.error(f"Error cancelling appointment: {str(e)}")
            await self.db.rollback()
            return False, None, "INTERNAL_ERROR"

    # ========== CONFIGURATION ==========

    async def set_doctor_schedule(
        self,
        doctor_id: UUID,
        day_of_week: int,
        work_start: time_type,
        work_end: time_type,
        break_start: Optional[time_type] = None,
        break_end: Optional[time_type] = None,
        default_duration: int = 30,
        max_slots_per_day: int = 16,
        is_working_day: bool = True,
    ) -> bool:
        """
        Set working hours and slot generation rules for a doctor.

        Args:
            doctor_id: Doctor UUID
            day_of_week: 0=Monday, 6=Sunday
            work_start: Work start time (e.g., 09:00)
            work_end: Work end time (e.g., 17:00)
            break_start: Break start (e.g., 13:00)
            break_end: Break end (e.g., 14:00)
            default_duration: Default slot duration in minutes
            max_slots_per_day: Maximum slots to generate
            is_working_day: Whether doctor works this day

        Returns:
            True if successful
        """
        logger.info(f"Setting schedule for doctor {doctor_id} day {day_of_week}")

        try:
            # Check if config exists
            existing = await self.db.execute(
                select(DoctorScheduleConfig).where(
                    and_(
                        DoctorScheduleConfig.doctor_id == doctor_id,
                        DoctorScheduleConfig.day_of_week == day_of_week,
                    )
                )
            )
            
            config = existing.scalars().first()
            
            if config:
                # Update existing
                config.work_start_time = work_start
                config.work_end_time = work_end
                config.break_start_time = break_start
                config.break_end_time = break_end
                config.default_slot_duration_minutes = default_duration
                config.max_slots_per_day = max_slots_per_day
                config.is_working_day = is_working_day
            else:
                # Create new
                config = DoctorScheduleConfig(
                    doctor_id=doctor_id,
                    day_of_week=day_of_week,
                    is_working_day=is_working_day,
                    work_start_time=work_start,
                    work_end_time=work_end,
                    break_start_time=break_start,
                    break_end_time=break_end,
                    default_slot_duration_minutes=default_duration,
                    max_slots_per_day=max_slots_per_day,
                )
                self.db.add(config)
            
            await self.db.commit()
            logger.info(f"Schedule saved for doctor {doctor_id} day {day_of_week}")
            return True

        except Exception as e:
            logger.error(f"Failed to set schedule: {str(e)}")
            await self.db.rollback()
            return False

    async def get_doctor_schedule(self, doctor_id: UUID) -> List[DoctorScheduleConfig]:
        """Get complete weekly schedule for a doctor."""
        result = await self.db.execute(
            select(DoctorScheduleConfig)
            .where(DoctorScheduleConfig.doctor_id == doctor_id)
            .order_by(DoctorScheduleConfig.day_of_week)
        )
        return result.scalars().all()

    # ========== AUDIT & ANALYTICS ==========

    async def get_slot_audit_log(
        self,
        slot_id: UUID,
        limit: int = 50,
    ) -> List[SlotAuditLog]:
        """Get audit trail for a slot (all state transitions)."""
        result = await self.db.execute(
            select(SlotAuditLog)
            .where(SlotAuditLog.slot_id == slot_id)
            .order_by(SlotAuditLog.changed_at.desc())
            .limit(limit)
        )
        return result.scalars().all()

    async def get_cancellation_stats(
        self,
        doctor_id: UUID,
        start_date: date,
        end_date: date,
    ) -> dict:
        """
        Get cancellation statistics for a doctor in a date range.

        Used for analytics and identifying cancellation patterns.
        """
        query = text("""
        SELECT 
            COUNT(*) as total_cancellations,
            COUNT(DISTINCT appointment_date) as days_with_cancellations,
            ROUND(100.0 * COUNT(*) / NULLIF(
                (SELECT COUNT(*) FROM appointments_v2 
                 WHERE doctor_id = :doctor_id 
                 AND appointment_date >= :start_date 
                 AND appointment_date <= :end_date),
                0
            ), 2) as cancellation_rate
        FROM appointments_v2
        WHERE doctor_id = :doctor_id
        AND appointment_date >= :start_date
        AND appointment_date <= :end_date
        AND appointment_status = 'cancelled'
        """)
        
        result = await self.db.execute(
            query,
            {
                "doctor_id": str(doctor_id),
                "start_date": start_date,
                "end_date": end_date,
            }
        )
        
        row = result.first()
        return {
            "total_cancellations": row[0] or 0,
            "days_with_cancellations": row[1] or 0,
            "cancellation_rate": float(row[2] or 0.0),
        }
