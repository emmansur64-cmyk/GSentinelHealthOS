from __future__ import annotations

from api.app.application.ports import (
    SlotBookingPort,
    UnitOfWork,
    UrgentSlaMetricsRequest,
    UrgentSlaMetricsResult,
)
from api.app.domain.services import SlotBookingPolicy


class GetUrgentSlaMetricsUseCase:
    def __init__(self, booking_port: SlotBookingPort, uow: UnitOfWork):
        self._booking_port = booking_port
        self._uow = uow

    async def execute(self, request: UrgentSlaMetricsRequest) -> UrgentSlaMetricsResult:
        SlotBookingPolicy.validate_positive_id(request.doctor_id, "doctor_id")
        SlotBookingPolicy.validate_days_window(request.days)

        async with self._uow:
            return await self._booking_port.get_urgent_sla_metrics(request)
