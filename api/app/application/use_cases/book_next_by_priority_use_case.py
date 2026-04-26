from __future__ import annotations

from api.app.application.ports import (
    BookNextByPriorityRequest,
    BookNextByPriorityResult,
    SlotBookingPort,
    UnitOfWork,
)
from api.app.domain.services import SlotBookingPolicy


class BookNextByPriorityUseCase:
    def __init__(self, booking_port: SlotBookingPort, uow: UnitOfWork):
        self._booking_port = booking_port
        self._uow = uow

    async def execute(self, request: BookNextByPriorityRequest) -> BookNextByPriorityResult:
        try:
            SlotBookingPolicy.validate_positive_id(request.doctor_id, "doctor_id")
            SlotBookingPolicy.validate_positive_id(request.patient_id, "patient_id")
            SlotBookingPolicy.validate_book_next_rules(request.priority, request.allow_reassign)
        except ValueError as exc:
            return BookNextByPriorityResult(
                success=False,
                appointment_id=None,
                slot_id=None,
                booking_source=None,
                error=str(exc),
            )

        async with self._uow:
            result = await self._booking_port.book_next_by_priority(request)
            if result.success:
                await self._uow.commit()
            return result
