from __future__ import annotations

from datetime import datetime
import enum
import uuid
from typing import List, Optional

from sqlalchemy import String, DateTime, ForeignKey, Text, Integer
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


class AppointmentStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    REPROGRAMMED = "reprogrammed"


class Doctor(Base):
    __tablename__ = "doctors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    clinic_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    specialty: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    license_number: Mapped[Optional[str]] = mapped_column(String(80), nullable=True, unique=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relación con turnos
    appointments: Mapped[List["Appointment"]] = relationship("Appointment", back_populates="doctor")


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    clinic_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    dni: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), unique=True, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True)
    age: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    date_of_birth: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    medical_history: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    appointments: Mapped[List["Appointment"]] = relationship("Appointment", back_populates="patient")


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    clinic_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    date_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text)
    specialty: Mapped[Optional[str]] = mapped_column(String(120), nullable=True, index=True)
    source: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    whatsapp_conversation_id: Mapped[Optional[str]] = mapped_column(String(120), nullable=True, index=True)
    patient_full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    patient_dni: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    patient_phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    patient_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    patient_age: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=AppointmentStatus.SCHEDULED.value)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    doctor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("doctors.id"))
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"))

    doctor: Mapped["Doctor"] = relationship("Doctor", back_populates="appointments")
    patient: Mapped["Patient"] = relationship("Patient", back_populates="appointments")

    @property
    def appointment_date(self) -> datetime:
        return self.date_time

    @appointment_date.setter
    def appointment_date(self, value: datetime) -> None:
        self.date_time = value
