from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


EventType = Literal[
    "SlotReserved",
    "AppointmentCreated",
    "AppointmentCancelled",
    "NotificationSent",
    "NotificationFailed",
]


class EventMetadata(BaseModel):
    schema_version: int = 1
    producer: str = "booking-service"


class SlotReservedData(BaseModel):
    slot_id: int
    doctor_id: int
    patient_id: int
    priority: str = "normal"
    reservation_source: str = "api"


class AppointmentCreatedData(BaseModel):
    appointment_id: int
    slot_id: int
    doctor_id: int
    patient_id: int
    status: str = "scheduled"


class AppointmentCancelledData(BaseModel):
    appointment_id: int
    slot_id: int
    doctor_id: int
    patient_id: int
    reason: str = "patient_request"


class DomainEvent(BaseModel):
    event_id: UUID = Field(default_factory=uuid4)
    event_type: EventType
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    aggregate_type: str
    aggregate_id: str
    correlation_id: UUID
    causation_id: UUID
    data: dict[str, Any]
    metadata: EventMetadata = Field(default_factory=EventMetadata)

    def routing_key(self) -> str:
        mapping = {
            "SlotReserved": "slot.reserved",
            "AppointmentCreated": "appointment.created",
            "AppointmentCancelled": "appointment.cancelled",
            "NotificationSent": "notification.sent",
            "NotificationFailed": "notification.failed",
        }
        return mapping[self.event_type]
