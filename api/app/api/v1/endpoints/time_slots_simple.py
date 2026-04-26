"""Simplified FastAPI endpoints for slot-based appointments.

Endpoints:
✓ POST /api/v1/slots/generate - Generate slots
✓ GET /api/v1/slots/available - List available slots
✓ POST /api/v1/slots/book - Book a slot
✓ POST /api/v1/appointments/{id}/cancel - Cancel appointment
✓ GET /api/v1/slots/utilization - Get utilization stats
"""
from datetime import datetime
from typing import List
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.app.db.session import get_db
from api.app.models.time_slot_simple import TimeSlot
from api.app.services.time_slot_service_simple import TimeSlotService
from api.app.application import (
    BestSlotQueryRequest as AppBestSlotQueryRequest,
    FindBestSlotUseCase,
    BookNextByPriorityRequest as AppBookNextByPriorityRequest,
    BookNextByPriorityUseCase,
    GetReassignmentAuditUseCase,
    GetUrgentSlaMetricsUseCase,
    ReassignmentAuditRequest as AppReassignmentAuditRequest,
    RescheduleAppointmentRequest as AppRescheduleAppointmentRequest,
    RescheduleAppointmentUseCase,
    UrgentSlaMetricsRequest as AppUrgentSlaMetricsRequest,
)
from api.app.eventing.booking_workflows import BookingWorkflowService
from api.app.infrastructure import SqlAlchemySlotBookingGateway, SqlAlchemyUnitOfWork
from api.app.schemas.time_slot_schemas_simple import (
    GenerateSlotsRequest,
    GenerateSlotsResponse,
    BookSlotRequest,
    BookNextByPriorityRequest,
    BookSlotResponse,
    CancelAppointmentRequest,
    CancelAppointmentResponse,
    RescheduleAppointmentRequest,
    RescheduleAppointmentResponse,
    UtilizationResponse,
    AvailableSlotsResponse,
    TimeSlotResponse,
    BestSlotQueryResponse,
    ReassignmentAuditItem,
    UrgentSlaMetricsResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/slots", tags=["slots"])


# ============================================================================
# SLOT GENERATION
# ============================================================================

@router.post("/generate", response_model=GenerateSlotsResponse, status_code=201)
async def generate_slots(
    request: GenerateSlotsRequest,
    db: AsyncSession = Depends(get_db)
):
    """Generate slots for a doctor on a specific date.
    
    Example:
        POST /api/v1/slots/generate
        {
            "doctor_id": 1,
            "slot_date": "2026-04-05T00:00:00Z",
            "start_hour": 9,
            "end_hour": 17,
            "duration_minutes": 30
        }
    
    Returns:
        201 Created with list of generated slots or error
    """
    result = await TimeSlotService.generate_daily_slots(
        db=db,
        doctor_id=request.doctor_id,
        slot_date=request.slot_date.date(),
        start_hour=request.start_hour,
        end_hour=request.end_hour,
        duration_minutes=request.duration_minutes,
    )
    
    if result["error"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return GenerateSlotsResponse(
        generated=result["generated"],
        slots=[TimeSlotResponse.model_validate(s) for s in result["slots"]],
        error=None
    )


# ============================================================================
# AVAILABILITY CHECK
# ============================================================================

@router.get("/available", response_model=AvailableSlotsResponse)
async def get_available_slots(
    doctor_id: int = Query(..., description="Doctor ID"),
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    db: AsyncSession = Depends(get_db)
):
    """Get all available slots for a doctor on a date.
    
    Example:
        GET /api/v1/slots/available?doctor_id=1&date=2026-04-05
    
    Returns:
        200 OK with list of available slots
    """
    try:
        slot_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format (use YYYY-MM-DD)")
    
    slots = await TimeSlotService.get_available_slots(
        db=db,
        doctor_id=doctor_id,
        slot_date=slot_date
    )
    
    return AvailableSlotsResponse(
        doctor_id=doctor_id,
        date=datetime.combine(slot_date, datetime.min.time()),
        slots=[TimeSlotResponse.model_validate(s) for s in slots],
        count=len(slots)
    )


# ============================================================================
# BOOKING
# ============================================================================

@router.post("/book", response_model=BookSlotResponse, status_code=201)
async def book_slot(
    request: BookSlotRequest,
    db: AsyncSession = Depends(get_db)
):
    """Book a slot for a patient.
    
    ATOMIC: No race conditions - UPDATE without SELECT.
    
    Example:
        POST /api/v1/slots/book
        {
            "slot_id": 42,
            "patient_id": 99
        }
    
    Returns:
        201 Created with appointment ID
        409 Conflict if slot already booked
    """
    workflow = BookingWorkflowService(db)
    try:
        appointment_id = await workflow.reserve_slot(
            slot_id=request.slot_id,
            patient_id=request.patient_id,
            priority=request.priority,
            reservation_source="api",
        )
    except ValueError as exc:
        detail = str(exc)
        if detail in {"slot_not_available", "slot_conflict"}:
            raise HTTPException(status_code=409, detail=detail)
        if detail == "slot_not_found":
            raise HTTPException(status_code=404, detail=detail)
        raise HTTPException(status_code=400, detail=detail)
    
    return BookSlotResponse(
        success=True,
        appointment_id=appointment_id,
        booking_source="available",
        error=""
    )


@router.post("/book-next-by-priority", response_model=BookSlotResponse, status_code=201)
async def book_next_by_priority(
    request: BookNextByPriorityRequest,
    db: AsyncSession = Depends(get_db),
):
    """Auto-select and book best slot based on priority policy."""
    gateway = SqlAlchemySlotBookingGateway(db)
    uow = SqlAlchemyUnitOfWork(db)
    use_case = BookNextByPriorityUseCase(gateway, uow)
    result = await use_case.execute(
        AppBookNextByPriorityRequest(
            doctor_id=request.doctor_id,
            slot_date=request.slot_date.date(),
            patient_id=request.patient_id,
            priority=request.priority,
            allow_reassign=request.allow_reassign,
            displaced_by_user_id=request.displaced_by_user_id,
            reassignment_reason=request.reassignment_reason,
        )
    )

    if not result.success:
        if "invalid" in result.error.lower() or "must" in result.error.lower():
            raise HTTPException(status_code=400, detail=result.error)
        raise HTTPException(status_code=409, detail=result.error)

    return BookSlotResponse(
        success=True,
        appointment_id=result.appointment_id,
        booking_source=result.booking_source,
        error="",
    )


@router.get("/best-slot", response_model=BestSlotQueryResponse)
async def get_best_slot_for_priority(
    doctor_id: int = Query(..., description="Doctor ID"),
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    priority: str = Query("normal", description="normal | urgent"),
    allow_reassign: bool = Query(False, description="Allow reassignment for urgent"),
    db: AsyncSession = Depends(get_db),
):
    """Return best candidate slot according to priority policy."""
    try:
        slot_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format (use YYYY-MM-DD)")

    gateway = SqlAlchemySlotBookingGateway(db)
    uow = SqlAlchemyUnitOfWork(db)
    use_case = FindBestSlotUseCase(gateway, uow)
    result = await use_case.execute(
        AppBestSlotQueryRequest(
            doctor_id=doctor_id,
            slot_date=slot_date,
            priority=priority,
            allow_reassign=allow_reassign,
        )
    )
    return BestSlotQueryResponse(slot_id=result.slot_id, source=result.source)


@router.get("/reassignment-audit", response_model=List[ReassignmentAuditItem])
async def get_reassignment_audit(
    doctor_id: int = Query(..., description="Doctor ID"),
    limit: int = Query(50, ge=1, le=200, description="Max records"),
    db: AsyncSession = Depends(get_db),
):
    """Compliance endpoint: who displaced whom for urgent bookings."""
    gateway = SqlAlchemySlotBookingGateway(db)
    uow = SqlAlchemyUnitOfWork(db)
    use_case = GetReassignmentAuditUseCase(gateway, uow)
    result = await use_case.execute(
        AppReassignmentAuditRequest(
            doctor_id=doctor_id,
            limit=limit,
        )
    )
    return [ReassignmentAuditItem.model_validate(item) for item in result.items]


@router.get("/urgent-sla", response_model=UrgentSlaMetricsResponse)
async def get_urgent_sla_metrics(
    doctor_id: int = Query(..., description="Doctor ID"),
    days: int = Query(30, ge=1, le=365, description="Window in days"),
    db: AsyncSession = Depends(get_db),
):
    """Return urgent wait SLA and displacement percentage for a doctor."""
    gateway = SqlAlchemySlotBookingGateway(db)
    uow = SqlAlchemyUnitOfWork(db)
    use_case = GetUrgentSlaMetricsUseCase(gateway, uow)
    result = await use_case.execute(
        AppUrgentSlaMetricsRequest(
            doctor_id=doctor_id,
            days=days,
        )
    )
    return UrgentSlaMetricsResponse(**result.payload)


# ============================================================================
# CANCELLATION
# ============================================================================

@router.post("/appointments/{appointment_id}/cancel", response_model=CancelAppointmentResponse)
async def cancel_appointment(
    appointment_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Cancel an appointment and release the slot.
    
    Example:
        POST /api/v1/slots/appointments/42/cancel
    
    Returns:
        200 OK with released slot ID
        404 Not Found if appointment doesn't exist
    """
    workflow = BookingWorkflowService(db)
    try:
        slot_id = await workflow.cancel_appointment(appointment_id=appointment_id)
    except ValueError as exc:
        detail = str(exc)
        if detail == "appointment_not_found":
            raise HTTPException(status_code=404, detail=detail)
        if detail == "appointment_already_cancelled":
            raise HTTPException(status_code=409, detail=detail)
        raise HTTPException(status_code=400, detail=detail)
    
    return CancelAppointmentResponse(
        success=True,
        slot_id=slot_id,
        error=""
    )


@router.post("/appointments/{appointment_id}/reschedule", response_model=RescheduleAppointmentResponse)
async def reschedule_appointment(
    appointment_id: int,
    request: RescheduleAppointmentRequest,
    db: AsyncSession = Depends(get_db),
):
    """Reschedule a slot-based appointment to a new slot atomically."""
    gateway = SqlAlchemySlotBookingGateway(db)
    uow = SqlAlchemyUnitOfWork(db)
    use_case = RescheduleAppointmentUseCase(gateway, uow)
    result = await use_case.execute(
        AppRescheduleAppointmentRequest(
            appointment_id=appointment_id,
            new_slot_id=request.new_slot_id,
        )
    )

    if not result.success:
        if "not found" in result.error.lower():
            raise HTTPException(status_code=404, detail=result.error)
        if "not available" in result.error.lower() or "conflicts" in result.error.lower():
            raise HTTPException(status_code=409, detail=result.error)
        raise HTTPException(status_code=400, detail=result.error)

    return RescheduleAppointmentResponse(success=True, slot_id=result.slot_id, error="")


# ============================================================================
# UTILIZATION STATS
# ============================================================================

@router.get("/utilization", response_model=UtilizationResponse)
async def get_utilization(
    doctor_id: int = Query(..., description="Doctor ID"),
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    db: AsyncSession = Depends(get_db)
):
    """Get slot utilization stats for a doctor on a date.
    
    Example:
        GET /api/v1/slots/utilization?doctor_id=1&date=2026-04-05
    
    Returns:
        200 OK with utilization breakdown
    """
    try:
        slot_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format (use YYYY-MM-DD)")
    
    stats = await TimeSlotService.get_doctor_utilization(
        db=db,
        doctor_id=doctor_id,
        slot_date=slot_date
    )
    
    return UtilizationResponse(
        doctor_id=doctor_id,
        date=datetime.combine(slot_date, datetime.min.time()),
        **stats
    )
