from __future__ import annotations

from api.app.application.ports import BestSlotQueryRequest, BestSlotQueryResult, SlotBookingPort, UnitOfWork
from api.app.domain.services import SlotBookingPolicy


class FindBestSlotUseCase:
    def __init__(self, booking_port: SlotBookingPort, uow: UnitOfWork):
        self._booking_port = booking_port
        self._uow = uow

    async def execute(self, request: BestSlotQueryRequest) -> BestSlotQueryResult:
        SlotBookingPolicy.validate_positive_id(request.doctor_id, "doctor_id")
        SlotBookingPolicy.validate_priority(request.priority)

        async with self._uow:
            return await self._booking_port.find_best_slot(request)
