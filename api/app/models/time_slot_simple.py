"""Simplified SQLAlchemy models for slot-based appointments.

Core principle:
✓ time_slots: availability (status: available, booked, blocked)
✓ appointments: reservations (1-to-1 UNIQUE link per slot)
✓ NO race conditions: atomic UPDATE without prior SELECT
✓ NO datetime conflicts: discrete pre-generated slots

Guarantee: Only one appointment per slot (mathematically enforced by DB)
"""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey, Boolean,
    UniqueConstraint, Index, func, CheckConstraint
)
from sqlalchemy.orm import relationship

from api.app.db.base import Base


class TimeSlot(Base):
    """Discrete time availability unit.
    
    Status values:
    - 'available': open for booking
    - 'booked': appointment created  
    - 'blocked': admin blocked
    
    CONSTRAINT: UNIQUE(doctor_id, start_time) 
    → One slot per doctor per time
    """
    __tablename__ = "time_slots"

    id = Column(Integer(), primary_key=True, autoincrement=True)
    doctor_id = Column(Integer(), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Timing - simple datetime without duration calculation
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    
    # State machine
    status = Column(String(20), nullable=False, default="available", index=True)
    # Values: 'available', 'booked', 'blocked'
    priority_override = Column(String(20), nullable=True)
    # Optional values: 'urgent' when an urgent booking takes a blocked slot
    
    # Metadata
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Table constraints
    __table_args__ = (
        # Critical: Only one slot per doctor per start_time
        UniqueConstraint("doctor_id", "start_time", name="uq_doctor_slot"),
        # Indexes for query performance
        Index("idx_slots_doctor_status", "doctor_id", "status"),
        Index("idx_slots_doctor_time", "doctor_id", "start_time"),
        # Validation
        CheckConstraint("start_time < end_time", name="ck_start_before_end"),
        CheckConstraint(
            "priority_override IS NULL OR priority_override IN ('normal', 'urgent')",
            name="ck_slot_priority_override_valid",
        ),
    )

    # Relationships
    appointment = relationship(
        "Appointment", 
        back_populates="slot", 
        uselist=False,
        cascade="all, delete-orphan"
    )
    required_resources = relationship(
        "SlotResourceRequirement",
        back_populates="slot",
        cascade="all, delete-orphan",
    )
    outgoing_buffer_blocks = relationship(
        "SlotBufferBlock",
        foreign_keys="SlotBufferBlock.source_slot_id",
        back_populates="source_slot",
        cascade="all, delete-orphan",
    )
    incoming_buffer_blocks = relationship(
        "SlotBufferBlock",
        foreign_keys="SlotBufferBlock.blocked_slot_id",
        back_populates="blocked_slot",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<TimeSlot #{self.id} | {self.start_time} | {self.status}>"
    
    @property
    def is_available(self) -> bool:  # type: ignore
        """Can this slot be booked?"""
        return self.status == "available"


class DoctorScheduleConfig(Base):
    """Doctor-level slot configuration for booking policies such as buffers."""

    __tablename__ = "doctor_schedule_config"

    id = Column(Integer(), primary_key=True, autoincrement=True)
    doctor_id = Column(Integer(), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False, unique=True)
    buffer_minutes = Column(Integer(), nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_doctor_schedule_config_doctor", "doctor_id"),
        CheckConstraint("buffer_minutes >= 0 AND buffer_minutes <= 120", name="ck_buffer_minutes_range"),
    )

    def __repr__(self) -> str:
        return f"<DoctorScheduleConfig doctor={self.doctor_id} buffer={self.buffer_minutes}m>"


class Appointment(Base):
    """Reservation linked to exactly one slot.
    
    CRITICAL GUARANTEE: slot_id is UNIQUE
    → Mathematically impossible to have 2 appointments per slot
    
    This is the atomic link that removes race conditions.
    """
    __tablename__ = "appointments"

    id = Column(Integer(), primary_key=True, autoincrement=True)
    
    # The critical constraint: UNIQUE slot_id
    # This SINGLE constraint prevents ALL double-booking issues
    slot_id = Column(
        Integer(), 
        ForeignKey("time_slots.id", ondelete="RESTRICT"), 
        nullable=False, 
        unique=True  # ← THIS IS THE ATOMIC GUARANTEE
    )
    patient_id = Column(Integer(), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    
    # Status
    status = Column(String(20), nullable=False, default="scheduled")
    # Values: 'scheduled', 'completed', 'cancelled', 'no_show'
    priority = Column(String(20), nullable=False, default="normal", index=True)
    # Values: 'normal', 'urgent'
    google_event_id = Column(String(255), nullable=True, unique=True, index=True)
    google_sync_status = Column(String(20), nullable=False, default="pending", index=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Table constraints
    __table_args__ = (
        Index("idx_appointment_patient", "patient_id"),
        Index("idx_appointment_status", "status"),
        Index("idx_appointment_priority", "priority"),
        Index("idx_appointment_google_sync_status", "google_sync_status"),
        CheckConstraint("priority IN ('normal', 'urgent')", name="ck_appointment_priority_valid"),
        CheckConstraint(
            "google_sync_status IN ('pending', 'synced', 'failed')",
            name="ck_appointment_google_sync_status_valid",
        ),
    )

    # Relationships
    slot = relationship("TimeSlot", back_populates="appointment")

    def __repr__(self) -> str:
        return f"<Appointment #{self.id} | Slot: {self.slot_id} | {self.status}>"


class SlotBufferBlock(Base):
    """Tracks which booking caused a slot to be blocked by buffer.

    This preserves provenance so overlapping buffers can coexist and manual/admin
    blocked slots are not accidentally released during cancellation/reschedule.
    """

    __tablename__ = "slot_buffer_blocks"

    id = Column(Integer(), primary_key=True, autoincrement=True)
    source_slot_id = Column(Integer(), ForeignKey("time_slots.id", ondelete="CASCADE"), nullable=False, index=True)
    blocked_slot_id = Column(Integer(), ForeignKey("time_slots.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("source_slot_id", "blocked_slot_id", name="uq_slot_buffer_block_pair"),
        CheckConstraint("source_slot_id <> blocked_slot_id", name="ck_slot_buffer_block_not_self"),
        Index("idx_slot_buffer_blocks_blocked_slot", "blocked_slot_id"),
    )

    source_slot = relationship(
        "TimeSlot",
        foreign_keys=[source_slot_id],
        back_populates="outgoing_buffer_blocks",
    )
    blocked_slot = relationship(
        "TimeSlot",
        foreign_keys=[blocked_slot_id],
        back_populates="incoming_buffer_blocks",
    )


class AppointmentReassignmentAudit(Base):
    """Audit trail for urgent reassignments (who displaced whom)."""

    __tablename__ = "appointment_reassignment_audit"

    id = Column(Integer(), primary_key=True, autoincrement=True)
    doctor_id = Column(Integer(), nullable=False, index=True)
    displaced_appointment_id = Column(Integer(), ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False)
    urgent_appointment_id = Column(Integer(), ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False)
    old_slot_id = Column(Integer(), ForeignKey("time_slots.id", ondelete="RESTRICT"), nullable=False)
    new_slot_id = Column(Integer(), ForeignKey("time_slots.id", ondelete="RESTRICT"), nullable=False)
    displaced_by_user_id = Column(Integer(), nullable=True)
    reason = Column(String(500), nullable=True)
    urgent_wait_minutes = Column(Integer(), nullable=True)
    sla_target_minutes = Column(Integer(), nullable=True)
    sla_breached = Column(Boolean(), nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        Index("idx_reassign_audit_doctor_created", "doctor_id", "created_at"),
        Index("idx_reassign_audit_displaced_appt", "displaced_appointment_id"),
        Index("idx_reassign_audit_urgent_appt", "urgent_appointment_id"),
        Index("idx_reassign_audit_doctor_sla", "doctor_id", "sla_breached"),
    )


class SpecialtyPriorityPolicy(Base):
    """Policy to enable/disable urgent reassignment by specialty."""

    __tablename__ = "specialty_priority_policy"

    id = Column(Integer(), primary_key=True, autoincrement=True)
    specialty = Column(String(100), nullable=False, unique=True)
    allow_urgent_reassign = Column(Boolean(), nullable=False, default=False)
    urgent_sla_target_minutes = Column(Integer(), nullable=False, default=60)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_specialty_priority_specialty", "specialty"),
        CheckConstraint("urgent_sla_target_minutes > 0 AND urgent_sla_target_minutes <= 720", name="ck_urgent_sla_target_range"),
    )


class Resource(Base):
    """Schedulable resource calendar (doctor, room, equipment)."""

    __tablename__ = "resources"

    id = Column(Integer(), primary_key=True, autoincrement=True)
    type = Column(String(20), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    external_ref = Column(String(120), nullable=True, index=True)
    is_active = Column(Boolean(), nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("type IN ('doctor', 'room', 'equipment')", name="ck_resource_type_valid"),
        UniqueConstraint("type", "external_ref", name="uq_resource_type_external_ref"),
        Index("idx_resources_type_active", "type", "is_active"),
    )

    slots = relationship("ResourceSlot", back_populates="resource", cascade="all, delete-orphan")
    required_by_slots = relationship("SlotResourceRequirement", back_populates="resource", cascade="all, delete-orphan")


class ResourceSlot(Base):
    """Availability slots per resource to avoid cross-resource conflicts."""

    __tablename__ = "resource_slots"

    id = Column(Integer(), primary_key=True, autoincrement=True)
    resource_id = Column(Integer(), ForeignKey("resources.id", ondelete="CASCADE"), nullable=False, index=True)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), nullable=False, default="available", index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("resource_id", "start_time", name="uq_resource_slot"),
        Index("idx_resource_slots_resource_status", "resource_id", "status"),
        Index("idx_resource_slots_resource_time", "resource_id", "start_time"),
        CheckConstraint("start_time < end_time", name="ck_resource_slot_time_range"),
        CheckConstraint("status IN ('available', 'booked', 'blocked')", name="ck_resource_slot_status_valid"),
    )

    resource = relationship("Resource", back_populates="slots")


class SlotResourceRequirement(Base):
    """Many-to-many relation: one appointment slot may require multiple resources."""

    __tablename__ = "slot_resource_requirements"

    id = Column(Integer(), primary_key=True, autoincrement=True)
    slot_id = Column(Integer(), ForeignKey("time_slots.id", ondelete="CASCADE"), nullable=False, index=True)
    resource_id = Column(Integer(), ForeignKey("resources.id", ondelete="RESTRICT"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("slot_id", "resource_id", name="uq_slot_required_resource"),
        Index("idx_slot_required_resources_slot", "slot_id"),
        Index("idx_slot_required_resources_resource", "resource_id"),
    )

    slot = relationship("TimeSlot", back_populates="required_resources")
    resource = relationship("Resource", back_populates="required_by_slots")
