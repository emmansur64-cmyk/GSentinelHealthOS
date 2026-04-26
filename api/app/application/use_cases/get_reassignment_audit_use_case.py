from __future__ import annotations

from api.app.application.ports import (
    ReassignmentAuditRequest,
    ReassignmentAuditResult,
    SlotBookingPort,
    UnitOfWork,
)
from api.app.domain.services import SlotBookingPolicy


class GetReassignmentAuditUseCase:
    def __init__(self, booking_port: SlotBookingPort, uow: UnitOfWork):
        self._booking_port = booking_port
        self._uow = uow

    async def execute(self, request: ReassignmentAuditRequest) -> ReassignmentAuditResult:
        SlotBookingPolicy.validate_positive_id(request.doctor_id, "doctor_id")
        SlotBookingPolicy.validate_positive_id(request.limit, "limit")

        async with self._uow:
            return await self._booking_port.get_reassignment_audit(request)
