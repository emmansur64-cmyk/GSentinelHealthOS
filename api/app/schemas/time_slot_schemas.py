"""
Pydantic schemas for time slot models and API requests/responses.
"""

from datetime import datetime, date, time as time_type
from typing import Optional
from uuid import UUID
from enum import Enum

from pydantic import BaseModel, Field, validator


# ========== ENUMS ==========

class SlotStatus(str, Enum):
    """Slot status options."""
    AVAILABLE = "available"
    BOOKED = "booked"
    BLOCKED = "blocked"
    CANCELLED = "cancelled"


class AppointmentStatus(str, Enum):
    """Appointment status options."""
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


# ========== TIME SLOT SCHEMAS ==========

class TimeSlotRequest(BaseModel):
    """Request to create a time slot."""
    doctor_id: UUID
    slot_date: date
    slot_start_time: time_type
    slot_end_time: time_type
    slot_duration_minutes: int = Field(default=30, ge=15, le=120)
    slot_status: SlotStatus = SlotStatus.AVAILABLE

    class Config:
        use_enum_values = True


class TimeSlotResponse(BaseModel):
    """Time slot details."""
    slot_id: UUID
    doctor_id: UUID
    slot_date: date
    slot_start_time: time_type
    slot_end_time: time_type
    slot_duration_minutes: int
    slot_status: SlotStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        use_enum_values = True


class TimeSlotDetailedResponse(TimeSlotResponse):
    """Time slot with appointment details (if booked)."""
    appointment: Optional['AppointmentResponse'] = None


# ========== APPOINTMENT SCHEMAS ==========

class AppointmentCreate(BaseModel):
    """Request to create an appointment."""
    slot_id: UUID
    patient_id: UUID
    appointment_notes: Optional[str] = None
    idempotency_key: Optional[str] = None


class AppointmentResponse(BaseModel):
    """Appointment details."""
    appointment_id: UUID
    slot_id: UUID
    doctor_id: UUID
    patient_id: UUID
    appointment_date: date
    appointment_status: AppointmentStatus
    appointment_notes: Optional[str] = None
    cancellation_reason: Optional[str] = None
    cancelled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        use_enum_values = True


class AppointmentCancelRequest(BaseModel):
    """Request to cancel an appointment."""
    cancellation_reason: Optional[str] = None
    cancelled_by_user_id: Optional[UUID] = None


# ========== BOOKING & SLOT REQUESTS ==========

class SlotBookingRequest(BaseModel):
    """Request to book a slot."""
    slot_id: UUID = Field(..., description="UUID of the slot to book")
    patient_id: UUID = Field(..., description="UUID of the patient")
    appointment_notes: Optional[str] = Field(None, max_length=500)
    idempotency_key: Optional[str] = Field(None, max_length=255)

    class Config:
        schema_extra = {
            "example": {
                "slot_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
                "patient_id": "a1b2c3d4-e5f6-4g7h-8i9j-0k1l2m3n4o5p",
                "appointment_notes": "Initial consultation",
                "idempotency_key": "booking-2026-04-02-12345",
            }
        }


class SlotBookingResponse(BaseModel):
    """Response after booking a slot."""
    appointment_id: UUID
    slot_id: UUID
    status: str = "SUCCESS"
    message: str


class DayScheduleConfig(BaseModel):
    """Daily schedule configuration."""
    day_of_week: int = Field(..., ge=0, le=6, description="0=Monday, 6=Sunday")
    is_working_day: bool
    work_start_time: time_type
    work_end_time: time_type
    break_start_time: Optional[time_type] = None
    break_end_time: Optional[time_type] = None
    default_slot_duration_minutes: int
    max_slots_per_day: int

    @property
    def day_name(self) -> str:
        """Get day name."""
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        return days[self.day_of_week]

    class Config:
        from_attributes = True


class DoctorScheduleResponse(BaseModel):
    """Doctor's full weekly schedule."""
    doctor_id: UUID
    schedule_config: DayScheduleConfig

    class Config:
        from_attributes = True


class DocScheduleRequest(BaseModel):
    """Request to set doctor schedule."""
    day_of_week: int = Field(..., ge=0, le=6)
    is_working_day: bool = True
    work_start_time: time_type
    work_end_time: time_type
    break_start_time: Optional[time_type] = None
    break_end_time: Optional[time_type] = None
    default_slot_duration_minutes: int = 30
    max_slots_per_day: int = 16


# ========== AUDIT & ANALYTICS ==========

class SlotAuditLogResponse(BaseModel):
    """Audit log entry for slot state changes."""
    audit_id: UUID
    slot_id: UUID
    doctor_id: UUID
    old_status: Optional[SlotStatus] = None
    new_status: SlotStatus
    change_reason: Optional[str] = None
    changed_by_user_id: Optional[UUID] = None
    changed_at: datetime

    class Config:
        from_attributes = True
        use_enum_values = True


class SlotUtilizationStats(BaseModel):
    """Doctor's slot utilization metrics."""
    doctor_id: UUID
    date: date
    total: int = 0
    available: int = 0
    booked: int = 0
    blocked: int = 0
    cancelled: int = 0

    @property
    def utilization_rate(self) -> float:
        """Percentage of booked slots."""
        if self.total == 0:
            return 0.0
        return round(100.0 * self.booked / self.total, 2)

    @property
    def availability_rate(self) -> float:
        """Percentage of available slots."""
        if self.total == 0:
            return 0.0
        return round(100.0 * self.available / self.total, 2)


class CancellationStats(BaseModel):
    """Doctor cancellation statistics."""
    doctor_id: UUID
    start_date: date
    end_date: date
    total_cancellations: int
    days_with_cancellations: int
    cancellation_rate: float  # Percentage


# ========== BATCH OPERATIONS ==========

class SlotGenerationStats(BaseModel):
    """Statistics from batch slot generation."""
    generated: int
    skipped: int
    errors: int

    @property
    def success_rate(self) -> float:
        """Percentage of days successfully generated."""
        total = self.generated + self.skipped
        if total == 0:
            return 0.0
        return round(100.0 * self.generated / total, 2)


class BulkSlotResponse(BaseModel):
    """Response from slot generation operations."""
    slots: list[TimeSlotResponse] = []
    count: int = 0
    stats: Optional[SlotGenerationStats] = None


# ========== AVAILABILITY VIEW ==========

class DayAvailability(BaseModel):
    """Doctor availability for a single day."""
    date: date
    available_count: int
    booked_count: int
    blocked_count: int
    total_count: int
    slots: list[TimeSlotResponse] = []


class WeekAvailability(BaseModel):
    """Doctor availability for a week."""
    doctor_id: UUID
    week_start: date
    week_end: date
    days: list[DayAvailability]

    @property
    def total_available(self) -> int:
        """Total available slots in the week."""
        return sum(day.available_count for day in self.days)

    @property
    def total_booked(self) -> int:
        """Total booked slots in the week."""
        return sum(day.booked_count for day in self.days)
