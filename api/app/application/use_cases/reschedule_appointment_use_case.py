from __future__ import annotations

from api.app.application.ports import (
    RescheduleAppointmentRequest,
    RescheduleAppointmentResult,
    SlotBookingPort,
    UnitOfWork,
)
from api.app.domain.services import SlotBookingPolicy


class RescheduleAppointmentUseCase:
    def __init__(self, booking_port: SlotBookingPort, uow: UnitOfWork):
        self._booking_port = booking_port
        self._uow = uow

    async def execute(self, request: RescheduleAppointmentRequest) -> RescheduleAppointmentResult:
        try:
            SlotBookingPolicy.validate_positive_id(request.appointment_id, "appointment_id")
            SlotBookingPolicy.validate_positive_id(request.new_slot_id, "new_slot_id")
        except ValueError as exc:
            return RescheduleAppointmentResult(success=False, slot_id=None, error=str(exc))

        async with self._uow:
            result = await self._booking_port.reschedule_appointment(request)
            if result.success:
                await self._uow.commit()
            return result
