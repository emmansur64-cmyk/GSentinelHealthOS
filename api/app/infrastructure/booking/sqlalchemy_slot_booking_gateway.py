from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from api.app.application.ports import (
    BestSlotQueryRequest,
    BestSlotQueryResult,
    BookNextByPriorityRequest,
    BookNextByPriorityResult,
    CancelAppointmentRequest,
    CancelAppointmentResult,
    ReassignmentAuditRequest,
    ReassignmentAuditResult,
    ReserveSlotRequest,
    ReserveSlotResult,
    RescheduleAppointmentRequest,
    RescheduleAppointmentResult,
    SlotBookingPort,
    UrgentSlaMetricsRequest,
    UrgentSlaMetricsResult,
)
from api.app.services.time_slot_service_simple import TimeSlotService


class SqlAlchemySlotBookingGateway(SlotBookingPort):
    """Infrastructure adapter: wraps legacy TimeSlotService behind application port."""

    def __init__(self, db: AsyncSession):
        self._db = db

    async def reserve_slot(self, request: ReserveSlotRequest) -> ReserveSlotResult:
        success, appointment_id, error = await TimeSlotService.book_slot(
            db=self._db,
            slot_id=request.slot_id,
            patient_id=request.patient_id,
            priority=request.priority,
            allow_reassign=request.allow_reassign,
            displaced_by_user_id=request.displaced_by_user_id,
            reassignment_reason=request.reassignment_reason,
        )
        return ReserveSlotResult(
            success=success,
            appointment_id=appointment_id,
            error=error,
        )

    async def cancel_appointment(self, request: CancelAppointmentRequest) -> CancelAppointmentResult:
        success, slot_id, error = await TimeSlotService.cancel_appointment(
            db=self._db,
            appointment_id=request.appointment_id,
        )
        return CancelAppointmentResult(success=success, slot_id=slot_id, error=error)

    async def book_next_by_priority(self, request: BookNextByPriorityRequest) -> BookNextByPriorityResult:
        success, appointment_id, slot_id, source, error = await TimeSlotService.book_next_by_priority(
            db=self._db,
            doctor_id=request.doctor_id,
            slot_date=request.slot_date,
            patient_id=request.patient_id,
            priority=request.priority,
            allow_reassign=request.allow_reassign,
            displaced_by_user_id=request.displaced_by_user_id,
            reassignment_reason=request.reassignment_reason,
        )
        return BookNextByPriorityResult(
            success=success,
            appointment_id=appointment_id,
            slot_id=slot_id,
            booking_source=source,
            error=error or "",
        )

    async def reschedule_appointment(self, request: RescheduleAppointmentRequest) -> RescheduleAppointmentResult:
        success, slot_id, error = await TimeSlotService.reschedule_appointment(
            db=self._db,
            appointment_id=request.appointment_id,
            new_slot_id=request.new_slot_id,
        )
        return RescheduleAppointmentResult(success=success, slot_id=slot_id, error=error)

    async def find_best_slot(self, request: BestSlotQueryRequest) -> BestSlotQueryResult:
        best = await TimeSlotService.find_best_slot_for_priority(
            db=self._db,
            doctor_id=request.doctor_id,
            slot_date=request.slot_date,
            priority=request.priority,
            allow_reassign=request.allow_reassign,
        )
        return BestSlotQueryResult(slot_id=best.get("slot_id"), source=best.get("source"))

    async def get_reassignment_audit(self, request: ReassignmentAuditRequest) -> ReassignmentAuditResult:
        rows = await TimeSlotService.get_reassignment_audit(
            db=self._db,
            doctor_id=request.doctor_id,
            limit=request.limit,
        )
        return ReassignmentAuditResult(
            items=[
                {
                    "id": int(row.id),
                    "doctor_id": int(row.doctor_id),
                    "displaced_appointment_id": int(row.displaced_appointment_id),
                    "urgent_appointment_id": int(row.urgent_appointment_id),
                    "old_slot_id": int(row.old_slot_id),
                    "new_slot_id": int(row.new_slot_id),
                    "displaced_by_user_id": row.displaced_by_user_id,
                    "reason": row.reason,
                    "urgent_wait_minutes": row.urgent_wait_minutes,
                    "sla_target_minutes": row.sla_target_minutes,
                    "sla_breached": bool(row.sla_breached),
                    "created_at": row.created_at,
                }
                for row in rows
            ]
        )

    async def get_urgent_sla_metrics(self, request: UrgentSlaMetricsRequest) -> UrgentSlaMetricsResult:
        payload = await TimeSlotService.get_urgent_sla_metrics(
            db=self._db,
            doctor_id=request.doctor_id,
            days=request.days,
        )
        return UrgentSlaMetricsResult(payload=payload)
