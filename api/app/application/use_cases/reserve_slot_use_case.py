from __future__ import annotations

from api.app.application.ports import ReserveSlotRequest, ReserveSlotResult, SlotBookingPort, UnitOfWork
from api.app.domain.services import SlotBookingPolicy


class ReserveSlotUseCase:
    def __init__(self, booking_port: SlotBookingPort, uow: UnitOfWork):
        self._booking_port = booking_port
        self._uow = uow

    async def execute(self, request: ReserveSlotRequest) -> ReserveSlotResult:
        try:
            SlotBookingPolicy.validate_positive_id(request.slot_id, "slot_id")
            SlotBookingPolicy.validate_positive_id(request.patient_id, "patient_id")
            SlotBookingPolicy.validate_priority(request.priority)
        except ValueError as exc:
            return ReserveSlotResult(success=False, appointment_id=None, error=str(exc))

        async with self._uow:
            result = await self._booking_port.reserve_slot(request)
            if result.success:
                await self._uow.commit()
            return result
