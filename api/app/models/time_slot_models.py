"""
Time Slot Models for Appointment Scheduling

Implements slot-based appointment model to eliminate overlaps and support scalability.
- TimeSlot: Represents a specific doctor availability window
- SlotAuditLog: Tracks all slot state transitions for compliance
- DoctorScheduleConfig: Defines working hours and slot generation rules
- AppointmentV2: Links to slots instead of datetime
"""

from datetime import datetime, date, time as time_type
from enum import Enum
from typing import Optional
from uuid import UUID

from sqlalchemy import (
    Column, String, Integer, DateTime, Date, Time, Boolean, Text, Enum as SQLEnum,
    ForeignKey, UniqueConstraint, CheckConstraint, Index, func
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

from api.app.db.base import Base


class SlotStatusEnum(str, Enum):
    """Slot availability states."""
    AVAILABLE = "available"      # Slot is open for booking
    BOOKED = "booked"            # Slot is reserved by appointment
    BLOCKED = "blocked"          # Doctor blocked it (lunch, vacation, etc)
    CANCELLED = "cancelled"      # Slot was cancelled


class AppointmentStatusEnum(str, Enum):
    """Appointment lifecycle states."""
    SCHEDULED = "scheduled"      # Confirmed appointment
    COMPLETED = "completed"      # Already seen
    CANCELLED = "cancelled"      # Patient or doctor cancelled
    NO_SHOW = "no_show"         # Patient didn't show up


class TimeSlot(Base):
    """
    Represents a discrete appointment slot for a doctor on a specific date.
    
    This is the core of the slot-based model:
    - Each slot has fixed duration (15, 30, 60 min)
    - Slots are pre-generated for each doctor's working day
    - One appointment per slot (guaranteed via unique constraint)
    - Status transitions prevent double-booking
    
    Advantages over free-form datetime:
    - No overlapping appointments (constraint at DB level)
    - Deterministic availability queries (just filter by status)
    - Easier for patients (discrete options instead of any datetime)
    - Better resource utilization (no gaps in scheduling)
    """
    __tablename__ = "time_slots"

    # Identifiers
    slot_id = Column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    clinic_id = Column(PGUUID(as_uuid=True), nullable=True, index=True)
    doctor_id = Column(PGUUID(as_uuid=True), ForeignKey("doctors.doctor_id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Slot timing
    slot_date = Column(Date(), nullable=False, index=True)
    slot_start_time = Column(Time(), nullable=False)
    slot_end_time = Column(Time(), nullable=False)  # Computed, stored for query efficiency
    slot_duration_minutes = Column(Integer(), nullable=False, default=30)
    
    # State
    slot_status = Column(SQLEnum(SlotStatusEnum), nullable=False, default=SlotStatusEnum.AVAILABLE, index=True)
    is_deleted = Column(Boolean(), nullable=False, default=False)  # Soft delete for audit trail
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    doctor = relationship("Doctor", foreign_keys=[doctor_id], backref="time_slots")
    appointment = relationship("AppointmentV2", uselist=False, back_populates="time_slot", cascade="all, delete-orphan")
    audit_logs = relationship("SlotAuditLog", back_populates="time_slot", cascade="all, delete-orphan")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint("slot_id", name="uq_time_slots_slot_id"),
        CheckConstraint("slot_start_time < slot_end_time", name="ck_slot_start_before_end"),
        CheckConstraint("slot_duration_minutes > 0", name="ck_slot_duration_positive"),
        CheckConstraint("slot_duration_minutes IN (15, 30, 45, 60, 90, 120)", name="ck_slot_duration_valid"),
        Index("idx_time_slots_doctor_date", "doctor_id", "slot_date"),
        Index("idx_time_slots_doctor_date_status", "doctor_id", "slot_date", "slot_status"),
        Index("idx_time_slots_status_created", "slot_status", "created_at"),
    )

    def is_available(self) -> bool:
        """Check if slot can be booked."""
        return self.slot_status == SlotStatusEnum.AVAILABLE and not self.is_deleted

    def __repr__(self) -> str:
        return f"<TimeSlot {self.slot_id} {self.slot_date} {self.slot_start_time}-{self.slot_end_time} {self.slot_status}>"


class SlotAuditLog(Base):
    """
    Audit trail for time slot state transitions.
    
    Tracking purposes:
    - Compliance: Who cancelled which slot and why
    - Analytics: Understand overbooking patterns and cancellations
    - Debugging: Trace why a slot was released back to available
    """
    __tablename__ = "slot_audit_log"

    # Identifiers
    audit_id = Column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    clinic_id = Column(PGUUID(as_uuid=True), nullable=True, index=True)
    slot_id = Column(PGUUID(as_uuid=True), ForeignKey("time_slots.slot_id", ondelete="CASCADE"), nullable=False)
    doctor_id = Column(PGUUID(as_uuid=True), ForeignKey("doctors.doctor_id", ondelete="CASCADE"), nullable=False)
    
    # State change
    old_status = Column(SQLEnum(SlotStatusEnum), nullable=True)
    new_status = Column(SQLEnum(SlotStatusEnum), nullable=False)
    change_reason = Column(String(500), nullable=True)  # e.g., "Patient cancelled", "Doctor blocked for lunch"
    
    # Who made the change
    changed_by_user_id = Column(PGUUID(as_uuid=True), nullable=True)  # NULL = system
    changed_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    time_slot = relationship("TimeSlot", back_populates="audit_logs")
    
    # Indexes
    __table_args__ = (
        Index("idx_slot_audit_slot_id_changed", "slot_id", "changed_at"),
        Index("idx_slot_audit_doctor_id_changed", "doctor_id", "changed_at"),
    )

    def __repr__(self) -> str:
        return f"<SlotAuditLog {self.audit_id} {self.slot_id}: {self.old_status} → {self.new_status}>"


class DoctorScheduleConfig(Base):
    """
    Configuration for automatic slot generation.
    
    Defines working hours for each doctor by day of week.
    Used by generate_daily_slots_for_doctor() to create slots automatically.
    
    Example:
    - Monday-Friday: 09:00-17:00 with 30-min slots, lunch 13:00-14:00
    - Saturday-Sunday: off (is_working_day=False)
    """
    __tablename__ = "doctor_schedule_config"

    # Identifiers
    config_id = Column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    clinic_id = Column(PGUUID(as_uuid=True), nullable=True, index=True)
    doctor_id = Column(PGUUID(as_uuid=True), ForeignKey("doctors.doctor_id", ondelete="CASCADE"), nullable=False)
    
    # Day schedule (0=Monday, 6=Sunday)
    day_of_week = Column(Integer(), nullable=False)
    is_working_day = Column(Boolean(), nullable=False, default=True)
    
    # Working hours
    work_start_time = Column(Time(), nullable=False, default=time_type(9, 0))
    work_end_time = Column(Time(), nullable=False, default=time_type(17, 0))
    break_start_time = Column(Time(), nullable=True, default=time_type(13, 0))
    break_end_time = Column(Time(), nullable=True, default=time_type(14, 0))
    
    # Slot generation rules
    default_slot_duration_minutes = Column(Integer(), nullable=False, default=30)
    max_slots_per_day = Column(Integer(), nullable=False, default=16)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    doctor = relationship("Doctor", foreign_keys=[doctor_id], backref="schedule_configs")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint("doctor_id", "day_of_week", name="uq_doctor_schedule_doctor_dow"),
        CheckConstraint("day_of_week >= 0 AND day_of_week <= 6", name="ck_day_of_week_valid"),
        CheckConstraint("work_start_time < work_end_time", name="ck_work_start_before_end"),
        CheckConstraint("default_slot_duration_minutes IN (15, 30, 45, 60, 90, 120)", name="ck_default_slot_duration"),
        Index("idx_doctor_schedule_doctor_id", "doctor_id"),
    )

    def __repr__(self) -> str:
        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        working = "working" if self.is_working_day else "off"
        return f"<DoctorScheduleConfig {self.doctor_id} {day_names[self.day_of_week]}: {working}>"


class AppointmentV2(Base):
    """
    Slot-based appointment model (V2).
    
    Changes from original model:
    - Uses slot_id instead of free-form datetime
    - One appointment per slot (guaranteed by unique constraint)
    - Supports idempotency for retried booking requests
    - Tracks cancellation reason and who cancelled
    
    This prevents:
    ✓ Double-booking (slot can only be in one status at a time)
    ✓ Overlapping appointments (slots don't overlap by definition)
    ✓ Race conditions (database enforces 1-to-1 relationship)
    ✓ Duplicate bookings (idempotency key deduplication)
    """
    __tablename__ = "appointments_v2"

    # Identifiers
    appointment_id = Column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    clinic_id = Column(PGUUID(as_uuid=True), nullable=True, index=True)
    slot_id = Column(PGUUID(as_uuid=True), ForeignKey("time_slots.slot_id", ondelete="RESTRICT"), nullable=False, unique=True)
    doctor_id = Column(PGUUID(as_uuid=True), ForeignKey("doctors.doctor_id", ondelete="CASCADE"), nullable=False)
    patient_id = Column(PGUUID(as_uuid=True), ForeignKey("patients.patient_id", ondelete="CASCADE"), nullable=False)
    
    # Appointment info
    appointment_date = Column(Date(), nullable=False)  # Denormalized from time_slots.slot_date for query efficiency
    appointment_status = Column(SQLEnum(AppointmentStatusEnum), nullable=False, default=AppointmentStatusEnum.SCHEDULED)
    appointment_notes = Column(Text(), nullable=True)
    
    # Cancellation info
    cancellation_reason = Column(String(500), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_by_user_id = Column(PGUUID(as_uuid=True), nullable=True)
    
    # Idempotency for request deduplication
    idempotency_key = Column(String(255), nullable=True, unique=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    time_slot = relationship("TimeSlot", back_populates="appointment")
    doctor = relationship("Doctor", foreign_keys=[doctor_id], backref="appointments_v2")
    patient = relationship("Patient", foreign_keys=[patient_id], backref="appointments_v2")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint("idempotency_key", name="uq_appointments_v2_idempotency_key"),
        Index("idx_appointments_v2_slot_id", "slot_id"),
        Index("idx_appointments_v2_doctor_date", "doctor_id", "appointment_date"),
        Index("idx_appointments_v2_patient_date", "patient_id", "appointment_date"),
        Index("idx_appointments_v2_status_created", "appointment_status", "created_at"),
    )

    def is_cancelled(self) -> bool:
        """Check if appointment is cancelled."""
        return self.appointment_status == AppointmentStatusEnum.CANCELLED

    def can_be_cancelled(self) -> bool:
        """Check if appointment can still be cancelled."""
        return self.appointment_status in [
            AppointmentStatusEnum.SCHEDULED,
            AppointmentStatusEnum.NO_SHOW,
        ]

    def __repr__(self) -> str:
        return f"<AppointmentV2 {self.appointment_id} {self.appointment_date} {self.appointment_status}>"
