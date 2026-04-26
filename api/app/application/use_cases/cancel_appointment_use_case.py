from __future__ import annotations

from api.app.application.ports import (
    CancelAppointmentRequest,
    CancelAppointmentResult,
    SlotBookingPort,
    UnitOfWork,
)
from api.app.domain.services import SlotBookingPolicy


class CancelAppointmentUseCase:
    def __init__(self, booking_port: SlotBookingPort, uow: UnitOfWork):
        self._booking_port = booking_port
        self._uow = uow

    async def execute(self, request: CancelAppointmentRequest) -> CancelAppointmentResult:
        try:
            SlotBookingPolicy.validate_positive_id(request.appointment_id, "appointment_id")
        except ValueError as exc:
            return CancelAppointmentResult(success=False, slot_id=None, error=str(exc))

        async with self._uow:
            result = await self._booking_port.cancel_appointment(request)
            if result.success:
                await self._uow.commit()
            return result
