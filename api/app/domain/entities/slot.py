from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class SlotStatus(str, Enum):
    AVAILABLE = "available"
    BOOKED = "booked"
    BLOCKED = "blocked"


@dataclass
class Slot:
    id: int
    doctor_id: int
    status: SlotStatus

    def can_be_reserved(self) -> bool:
        return self.status in {SlotStatus.AVAILABLE, SlotStatus.BLOCKED}
