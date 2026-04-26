"""
Time Slot REST API Endpoints

Exposes slot-based appointment operations:
- GET /api/v1/slots/available - List available slots
- POST /api/v1/slots/book - Book a slot
- POST /api/v1/slots/generate - Generate slots for a doctor
- POST /api/v1/appointments/{id}/cancel - Cancel appointment and release slot
- GET /api/v1/doctors/{id}/utilization - Get doctor schedule utilization
"""

import logging
from datetime import date, time as time_type
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.app.db.session import async_session_local
from api.app.models.time_slot_models import TimeSlot, AppointmentV2
from api.app.services.time_slot_service import TimeSlotService
from api.app.schemas.appointments import (
    AppointmentCreate,
    AppointmentResponse,
    SlotBookingRequest,
    SlotBookingResponse,
    TimeSlotResponse,
    DoctorScheduleResponse,
)
from core.exceptions import BusinessLogicError
from core.response.execution_adapter import ExecutionAdapter, ExecutionResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/slots", tags=["time-slots"])


# ========== DEPENDENCIES ==========

async def get_time_slot_service() -> TimeSlotService:
    """Dependency injection for TimeSlotService."""
    async with async_session_local() as db:
        yield TimeSlotService(db)


# ========== LIST & AVAILABILITY ==========

@router.get(
    "/available",
    response_model=ExecutionResponse,
    status_code=status.HTTP_200_OK,
    summary="List available slots for a doctor",
)
async def list_available_slots(
    doctor_id: UUID = Query(..., description="Doctor UUID"),
    date: date = Query(..., description="Date to check (YYYY-MM-DD)"),
    duration_minutes: Optional[int] = Query(None, description="Filter by duration (15, 30, 45, 60, 90, 120)"),
    db: AsyncSession = Depends(async_session_local),
) -> ExecutionResponse:
    """
    Get available time slots for a doctor on a specific date.

    This endpoint:
    - Returns only 'available' slots (booked/blocked slots excluded)
    - Uses indexed query for O(1) lookup
    - Supports filtering by slot duration
    - Returns slots sorted by start time

    Query Parameters:
    - doctor_id: Doctor UUID (required)
    - date: Date in YYYY-MM-DD format (required)
    - duration_minutes: Optional filter (15, 30, 60, etc)

    Response:
    - 200 OK with list of slots
    - 400 if parameters invalid
    """
    try:
        service = TimeSlotService(db)
        slots = await service.get_available_slots(doctor_id, date, duration_minutes)

        slots_response = [
            TimeSlotResponse.from_orm(slot) for slot in slots
        ]

        return ExecutionResponse(
            success=True,
            data={"slots": slots_response, "count": len(slots_response)},
            message=f"Found {len(slots_response)} available slots",
        )

    except Exception as e:
        logger.error(f"Error listing slots: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/range",
    response_model=ExecutionResponse,
    status_code=status.HTTP_200_OK,
    summary="List available slots across date range",
)
async def list_slots_range(
    doctor_id: UUID = Query(..., description="Doctor UUID"),
    start_date: date = Query(..., description="Range start (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Range end (YYYY-MM-DD)"),
    duration_minutes: Optional[int] = Query(None),
    db: AsyncSession = Depends(async_session_local),
) -> ExecutionResponse:
    """
    Get available slots across multiple days (e.g., for calendar view).

    Query Parameters:
    - doctor_id: Doctor UUID (required)
    - start_date: YYYY-MM-DD (required)
    - end_date: YYYY-MM-DD (required)
    - duration_minutes: Optional filter

    Response:
    - List of slots grouped by date
    """
    try:
        if start_date > end_date:
            raise ValueError("start_date must be <= end_date")

        service = TimeSlotService(db)
        slots = await service.get_available_slots_range(
            doctor_id, start_date, end_date, duration_minutes
        )

        # Group by date for easy client consumption
        by_date = {}
        for slot in slots:
            date_str = slot.slot_date.isoformat()
            if date_str not in by_date:
                by_date[date_str] = []
            by_date[date_str].append(TimeSlotResponse.from_orm(slot))

        return ExecutionResponse(
            success=True,
            data={"slots_by_date": by_date, "total_slots": len(slots)},
            message=f"Found {len(slots)} available slots across {len(by_date)} days",
        )

    except Exception as e:
        logger.error(f"Error listing slots range: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/{doctor_id}/utilization",
    response_model=ExecutionResponse,
    status_code=status.HTTP_200_OK,
    summary="Get doctor slot utilization",
)
async def get_doctor_utilization(
    doctor_id: UUID = Query(...),
    date: date = Query(..., description="Date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(async_session_local),
) -> ExecutionResponse:
    """
    Get slot utilization metrics for a doctor on a date.

    Returns counters for:
    - total: Total slots for the day
    - available: Open slots
    - booked: Reserved by appointments
    - blocked: Doctor blocked (lunch, etc)
    - cancelled: Cancelled slots

    Useful for:
    - Schedule overview dashboard
    - Capacity planning
    - Analytics
    """
    try:
        service = TimeSlotService(db)
        stats = await service.get_doctor_utilization(doctor_id, date)

        return ExecutionResponse(
            success=True,
            data=stats,
            message=f"Utilization metrics for {date}",
        )

    except Exception as e:
        logger.error(f"Error getting utilization: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


# ========== BOOKING ==========

@router.post(
    "/book",
    response_model=ExecutionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Book an available slot",
)
async def book_slot(
    request: SlotBookingRequest,
    db: AsyncSession = Depends(async_session_local),
) -> ExecutionResponse:
    """
    Book a slot for a patient.

    Request:
    - slot_id: UUID of the slot to book
    - patient_id: UUID of the patient
    - appointment_notes: Optional clinical notes
    - idempotency_key: Optional for request deduplication

    This operation is atomic:
    - Verifies slot is available
    - Updates slot status to 'booked'
    - Creates appointment record
    - Logs state transition to audit table

    Responses:
    - 201 Created: Successfully booked
    - 409 Conflict: Slot already booked or unavailable
    - 404 Not Found: Slot doesn't exist
    - 400 Bad Request: Invalid parameters
    """
    try:
        service = TimeSlotService(db)
        
        success, appointment_id, error_code = await service.book_slot(
            slot_id=request.slot_id,
            patient_id=request.patient_id,
            appointment_notes=request.appointment_notes,
            idempotency_key=request.idempotency_key,
        )

        if not success:
            status_map = {
                "SLOT_NOT_FOUND": (404, "Slot not found"),
                "SLOT_NOT_AVAILABLE": (409, "Slot is no longer available"),
                "INTERNAL_ERROR": (500, "Internal error during booking"),
            }
            
            http_status, message = status_map.get(error_code, (400, error_code))
            raise HTTPException(status_code=http_status, detail=message)

        # Fetch the created appointment
        stmt = select(AppointmentV2).where(AppointmentV2.appointment_id == appointment_id)
        result = await db.execute(stmt)
        appointment = result.scalars().first()

        return ExecutionResponse(
            success=True,
            data={
                "appointment": AppointmentResponse.from_orm(appointment),
                "appointment_id": str(appointment_id),
            },
            message="Slot booked successfully",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error booking slot: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


# ========== SLOT GENERATION ==========

@router.post(
    "/generate",
    response_model=ExecutionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate daily slots for a doctor",
)
async def generate_slots(
    doctor_id: UUID = Query(...),
    date: date = Query(..., description="Date to generate slots for"),
    duration_minutes: int = Query(30, ge=15, le=120),
    db: AsyncSession = Depends(async_session_local),
) -> ExecutionResponse:
    """
    Generate slots for a doctor on a specific date.

    Uses the doctor's working hours configuration to automatically create slots.

    Query Parameters:
    - doctor_id: Doctor UUID
    - date: Date (YYYY-MM-DD)
    - duration_minutes: Slot duration (default 30, options: 15, 30, 45, 60, 90, 120)

    Behavior:
    - Respects doctor's working hours (e.g., 09:00-17:00)
    - Skips break times (e.g., 13:00-14:00 lunch)
    - Won't regenerate if slots already exist for that day
    - Returns error if doctor has no schedule config for that day

    Response:
    - 201 Created: Slots generated
    - 400 Bad Request: Doctor has no schedule config for that day
    - 409 Conflict: Slots already exist for this date
    """
    try:
        service = TimeSlotService(db)
        slots = await service.generate_daily_slots(doctor_id, date, duration_minutes)

        slots_response = [TimeSlotResponse.from_orm(slot) for slot in slots]

        return ExecutionResponse(
            success=True,
            data={
                "slots": slots_response,
                "count": len(slots_response),
            },
            message=f"Generated {len(slots_response)} slots",
        )

    except BusinessLogicError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating slots: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/generate-batch",
    response_model=ExecutionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate slots for multiple days",
)
async def generate_slots_batch(
    doctor_id: UUID = Query(...),
    start_date: date = Query(..., description="First date"),
    num_days: int = Query(30, ge=1, le=90),
    duration_minutes: int = Query(30, ge=15, le=120),
    db: AsyncSession = Depends(async_session_local),
) -> ExecutionResponse:
    """
    Generate slots for a doctor across multiple consecutive days.

    Useful for:
    - Initial schedule setup
    - Bulk initialization
    - Monthly schedule generation

    Query Parameters:
    - doctor_id: Doctor UUID
    - start_date: First date (YYYY-MM-DD)
    - num_days: Number of days (1-90)
    - duration_minutes: Slot duration
    """
    try:
        service = TimeSlotService(db)
        stats = await service.generate_slots_batch(
            doctor_id, start_date, num_days, duration_minutes
        )

        return ExecutionResponse(
            success=True,
            data=stats,
            message=f"Generated {stats['generated']} days, skipped {stats['skipped']}",
        )

    except Exception as e:
        logger.error(f"Error in batch generation: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


# ========== CANCELLATIONS ==========

@router.post(
    "/appointments/{appointment_id}/cancel",
    response_model=ExecutionResponse,
    status_code=status.HTTP_200_OK,
    summary="Cancel appointment and release slot",
)
async def cancel_appointment(
    appointment_id: UUID,
    cancellation_reason: Optional[str] = Query(None),
    cancelled_by_user_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(async_session_local),
) -> ExecutionResponse:
    """
    Cancel an appointment and release its slot back to available.

    This operation:
    - Updates appointment status to 'cancelled'
    - Changes slot status from 'booked' → 'available'
    - Logs the cancellation with reason
    - Records who cancelled (user_id or system)

    Query Parameters:
    - appointment_id: Appointment UUID (path parameter)
    - cancellation_reason: Why it was cancelled (optional)
    - cancelled_by_user_id: Who cancelled (optional, system if omitted)

    Response:
    - 200 OK: Successfully cancelled
    - 404 Not Found: Appointment doesn't exist
    - 409 Conflict: Appointment already cancelled or completed
    """
    try:
        service = TimeSlotService(db)
        
        success, slot_id, error_code = await service.cancel_appointment(
            appointment_id=appointment_id,
            cancellation_reason=cancellation_reason,
            cancelled_by_user_id=cancelled_by_user_id,
        )

        if not success:
            status_map = {
                "APPOINTMENT_NOT_FOUND": 404,
                "APPOINTMENT_ALREADY_CANCELLED": 409,
                "APPOINTMENT_ALREADY_COMPLETED": 409,
            }
            http_status = status_map.get(error_code, 400)
            raise HTTPException(status_code=http_status, detail=error_code)

        return ExecutionResponse(
            success=True,
            data={
                "appointment_id": str(appointment_id),
                "slot_id": str(slot_id),
            },
            message="Appointment cancelled and slot released",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling appointment: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


# ========== SCHEDULE CONFIGURATION ==========

@router.get(
    "/doctors/{doctor_id}/schedule",
    response_model=ExecutionResponse,
    status_code=status.HTTP_200_OK,
    summary="Get doctor weekly schedule",
)
async def get_doctor_schedule(
    doctor_id: UUID,
    db: AsyncSession = Depends(async_session_local),
) -> ExecutionResponse:
    """
    Get the complete weekly schedule for a doctor.

    Returns working hours for each day of the week:
    - Day of week (0=Monday, 6=Sunday)
    - Working hours (start/end times)
    - Break times (lunch, etc)
    - Default slot duration
    - Maximum slots per day

    Response:
    - 200 OK with list of DayConfig objects
    """
    try:
        service = TimeSlotService(db)
        configs = await service.get_doctor_schedule(doctor_id)

        configs_response = [
            DoctorScheduleResponse.from_orm(config) for config in configs
        ]

        return ExecutionResponse(
            success=True,
            data={"schedule": configs_response},
            message="Doctor schedule retrieved",
        )

    except Exception as e:
        logger.error(f"Error getting schedule: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/doctors/{doctor_id}/schedule",
    response_model=ExecutionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Set doctor working hours for a day",
)
async def set_doctor_schedule(
    doctor_id: UUID,
    day_of_week: int = Query(..., ge=0, le=6, description="0=Monday, 6=Sunday"),
    work_start_time: time_type = Query(..., description="HH:MM:SS format"),
    work_end_time: time_type = Query(..., description="HH:MM:SS format"),
    is_working_day: bool = Query(True),
    break_start_time: Optional[time_type] = Query(None),
    break_end_time: Optional[time_type] = Query(None),
    default_slot_duration: int = Query(30, ge=15, le=120),
    max_slots_per_day: int = Query(16, ge=1, le=50),
    db: AsyncSession = Depends(async_session_local),
) -> ExecutionResponse:
    """
    Set working hours and slot generation rules for a doctor.

    This configures how slots should be generated for this doctor.

    Query Parameters:
    - doctor_id: Doctor UUID (path parameter)
    - day_of_week: 0-6 (0=Monday, 6=Sunday)
    - work_start_time: Start time (e.g., 09:00:00)
    - work_end_time: End time (e.g., 17:00:00)
    - is_working_day: Whether doctor works this day (default true)
    - break_start_time: Break start (e.g., 13:00:00, optional)
    - break_end_time: Break end (e.g., 14:00:00, optional)
    - default_slot_duration: Slot duration in minutes (15/30/45/60/90/120)
    - max_slots_per_day: Maximum slots to generate

    Example:
    - Monday 09:00-17:00 with 30-min slots and 13:00-14:00 lunch → 16 slots
    """
    try:
        service = TimeSlotService(db)
        success = await service.set_doctor_schedule(
            doctor_id=doctor_id,
            day_of_week=day_of_week,
            work_start=work_start_time,
            work_end=work_end_time,
            break_start=break_start_time,
            break_end=break_end_time,
            default_duration=default_slot_duration,
            max_slots_per_day=max_slots_per_day,
            is_working_day=is_working_day,
        )

        if not success:
            raise HTTPException(status_code=400, detail="Failed to set schedule")

        return ExecutionResponse(
            success=True,
            data={
                "doctor_id": str(doctor_id),
                "day_of_week": day_of_week,
            },
            message="Schedule configured successfully",
        )

    except Exception as e:
        logger.error(f"Error setting schedule: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
