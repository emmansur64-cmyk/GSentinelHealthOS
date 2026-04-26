from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class AppointmentStatus(str, Enum):
    SCHEDULED = "scheduled"
    CANCELLED = "cancelled"


@dataclass
class Appointment:
    id: int | None
    slot_id: int
    patient_id: int
    status: AppointmentStatus = AppointmentStatus.SCHEDULED

    def cancel(self) -> None:
        if self.status == AppointmentStatus.CANCELLED:
            raise ValueError("La cita ya estaba cancelada")
        self.status = AppointmentStatus.CANCELLED
