from __future__ import annotations

from datetime import date
from dataclasses import dataclass
from typing import Any, Protocol


@dataclass
class ReserveSlotRequest:
    slot_id: int
    patient_id: int
    priority: str = "normal"
    allow_reassign: bool = False
    displaced_by_user_id: int | None = None
    reassignment_reason: str | None = None


@dataclass
class ReserveSlotResult:
    success: bool
    appointment_id: int | None
    error: str


@dataclass
class CancelAppointmentRequest:
    appointment_id: int


@dataclass
class CancelAppointmentResult:
    success: bool
    slot_id: int | None
    error: str


@dataclass
class BookNextByPriorityRequest:
    doctor_id: int
    slot_date: date
    patient_id: int
    priority: str = "normal"
    allow_reassign: bool = False
    displaced_by_user_id: int | None = None
    reassignment_reason: str | None = None


@dataclass
class BookNextByPriorityResult:
    success: bool
    appointment_id: int | None
    slot_id: int | None
    booking_source: str | None
    error: str


@dataclass
class RescheduleAppointmentRequest:
    appointment_id: int
    new_slot_id: int


@dataclass
class RescheduleAppointmentResult:
    success: bool
    slot_id: int | None
    error: str


@dataclass
class BestSlotQueryRequest:
    doctor_id: int
    slot_date: date
    priority: str = "normal"
    allow_reassign: bool = False


@dataclass
class BestSlotQueryResult:
    slot_id: int | None
    source: str | None


@dataclass
class ReassignmentAuditRequest:
    doctor_id: int
    limit: int = 50


@dataclass
class ReassignmentAuditResult:
    items: list[dict[str, Any]]


@dataclass
class UrgentSlaMetricsRequest:
    doctor_id: int
    days: int = 30


@dataclass
class UrgentSlaMetricsResult:
    payload: dict[str, Any]


class SlotBookingPort(Protocol):
    async def reserve_slot(self, request: ReserveSlotRequest) -> ReserveSlotResult:
        raise NotImplementedError

    async def cancel_appointment(self, request: CancelAppointmentRequest) -> CancelAppointmentResult:
        raise NotImplementedError

    async def book_next_by_priority(self, request: BookNextByPriorityRequest) -> BookNextByPriorityResult:
        raise NotImplementedError

    async def reschedule_appointment(self, request: RescheduleAppointmentRequest) -> RescheduleAppointmentResult:
        raise NotImplementedError

    async def find_best_slot(self, request: BestSlotQueryRequest) -> BestSlotQueryResult:
        raise NotImplementedError

    async def get_reassignment_audit(self, request: ReassignmentAuditRequest) -> ReassignmentAuditResult:
        raise NotImplementedError

    async def get_urgent_sla_metrics(self, request: UrgentSlaMetricsRequest) -> UrgentSlaMetricsResult:
        raise NotImplementedError
