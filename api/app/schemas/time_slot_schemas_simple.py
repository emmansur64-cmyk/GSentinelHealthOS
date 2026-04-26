"""Simplified Pydantic schemas for slot-based appointments."""
from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, Field


# ============================================================================
# REQUEST SCHEMAS
# ============================================================================

class GenerateSlotsRequest(BaseModel):
    """Request to generate slots for a doctor."""
    doctor_id: int = Field(..., description="Doctor ID")
    slot_date: datetime = Field(..., description="Date to generate slots for")
    start_hour: int = Field(9, ge=0, le=23, description="Start hour (0-23)")
    end_hour: int = Field(17, ge=0, le=23, description="End hour (0-23)")
    duration_minutes: int = Field(30, ge=15, le=480, description="Slot duration in minutes")


class BookSlotRequest(BaseModel):
    """Request to book a slot."""
    slot_id: int = Field(..., description="TimeSlot ID to book")
    patient_id: int = Field(..., description="Patient ID")
    priority: Literal["normal", "urgent"] = Field("normal", description="Priority: normal | urgent")
    allow_reassign: bool = Field(False, description="Allow urgent reassignment of future normal appointments")
    displaced_by_user_id: Optional[int] = Field(None, description="User ID performing reassignment")
    reassignment_reason: Optional[str] = Field(None, description="Reason for urgent reassignment")


class BookNextByPriorityRequest(BaseModel):
    """Request to auto-pick best slot based on priority policy."""
    doctor_id: int = Field(..., description="Doctor ID")
    slot_date: datetime = Field(..., description="Date to search slots")
    patient_id: int = Field(..., description="Patient ID")
    priority: Literal["normal", "urgent"] = Field("normal", description="Priority: normal | urgent")
    allow_reassign: bool = Field(False, description="Allow urgent reassignment of future normal appointments")
    displaced_by_user_id: Optional[int] = Field(None, description="User ID performing reassignment")
    reassignment_reason: Optional[str] = Field(None, description="Reason for urgent reassignment")


class CancelAppointmentRequest(BaseModel):
    """Request to cancel an appointment."""
    appointment_id: int = Field(..., description="Appointment ID to cancel")


class RescheduleAppointmentRequest(BaseModel):
    """Request to move an appointment to another slot."""
    new_slot_id: int = Field(..., description="Target TimeSlot ID")


class SpecialtyPriorityPolicyCreateRequest(BaseModel):
    """Create a specialty policy for urgent reassignment."""
    specialty: str = Field(..., min_length=2, max_length=100, description="Medical specialty name")
    allow_urgent_reassign: bool = Field(False, description="Allow urgent reassignment for this specialty")
    urgent_sla_target_minutes: int = Field(60, ge=1, le=720, description="Urgent SLA target in minutes")


class SpecialtyPriorityPolicyUpdateRequest(BaseModel):
    """Partial update for specialty priority policy."""
    allow_urgent_reassign: Optional[bool] = Field(None, description="Allow urgent reassignment for this specialty")
    urgent_sla_target_minutes: Optional[int] = Field(None, ge=1, le=720, description="Urgent SLA target in minutes")


# ============================================================================
# RESPONSE SCHEMAS
# ============================================================================

class TimeSlotResponse(BaseModel):
    """Response representing a TimeSlot."""
    id: int
    doctor_id: int
    start_time: datetime
    end_time: datetime
    status: str  # 'available', 'booked', 'blocked'
    priority_override: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class AppointmentResponse(BaseModel):
    """Response representing an Appointment."""
    id: int
    slot_id: int
    patient_id: int
    status: str  # 'scheduled', 'completed', 'cancelled', 'no_show'
    priority: str
    google_sync_status: str = "pending"
    created_at: datetime
    slot: Optional[TimeSlotResponse] = None
    
    class Config:
        from_attributes = True


class GenerateSlotsResponse(BaseModel):
    """Response from slot generation."""
    generated: int = Field(..., description="Number of slots generated")
    slots: List[TimeSlotResponse] = Field(..., description="Generated slots")
    error: Optional[str] = Field(None, description="Error message if any")


class BookSlotResponse(BaseModel):
    """Response from booking a slot."""
    success: bool = Field(..., description="Whether booking succeeded")
    appointment_id: Optional[int] = Field(None, description="Created appointment ID")
    booking_source: Optional[str] = Field(None, description="available | blocked | reassign")
    error: str = Field("", description="Error message if any")


class BestSlotQueryResponse(BaseModel):
    """Best slot candidate based on priority policy."""
    slot_id: Optional[int] = None
    source: Optional[str] = None


class ReassignmentAuditItem(BaseModel):
    """Audit entry for urgent displacement operations."""
    id: int
    doctor_id: int
    displaced_appointment_id: int
    urgent_appointment_id: int
    old_slot_id: int
    new_slot_id: int
    displaced_by_user_id: Optional[int] = None
    reason: Optional[str] = None
    urgent_wait_minutes: Optional[int] = None
    sla_target_minutes: Optional[int] = None
    sla_breached: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class CancelAppointmentResponse(BaseModel):
    """Response from cancelling an appointment."""
    success: bool = Field(..., description="Whether cancellation succeeded")
    slot_id: Optional[int] = Field(None, description="Released slot ID")
    error: str = Field("", description="Error message if any")


class RescheduleAppointmentResponse(BaseModel):
    """Response from rescheduling an appointment."""
    success: bool = Field(..., description="Whether reschedule succeeded")
    slot_id: Optional[int] = Field(None, description="New slot ID")
    error: str = Field("", description="Error message if any")


class UtilizationResponse(BaseModel):
    """Doctor utilization stats for a date."""
    doctor_id: int
    date: datetime
    total: int = Field(..., description="Total slots")
    booked: int = Field(..., description="Booked slots")
    available: int = Field(..., description="Available slots")
    blocked: int = Field(..., description="Blocked slots")
    utilization_rate: float = Field(..., description="Percentage of booked slots")
    
    class Config:
        from_attributes = True


class AvailableSlotsResponse(BaseModel):
    """Response with available slots list."""
    doctor_id: int
    date: datetime
    slots: List[TimeSlotResponse]
    count: int = Field(..., description="Number of available slots")


class UrgentSlaMetricsResponse(BaseModel):
    """Urgent SLA metrics and displacement ratio per doctor."""
    doctor_id: int
    window_days: int
    urgent_total: int
    displaced_total: int
    displacement_rate_percent: float
    avg_urgent_wait_minutes: Optional[float] = None


class SpecialtyPriorityPolicyResponse(BaseModel):
    """Specialty policy details for urgent reassignment."""
    id: int
    specialty: str
    allow_urgent_reassign: bool
    urgent_sla_target_minutes: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
