from datetime import datetime
import uuid
from typing import List, Optional
from sqlalchemy import String, DateTime, ForeignKey, Text, Integer
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

class Base(DeclarativeBase):
    pass

class Doctor(Base):
    __tablename__ = "doctors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    specialty: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    buffer_before_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    buffer_after_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    
    # Relación con turnos
    appointments: Mapped[List["Appointment"]] = relationship("Appointment", back_populates="doctor")

class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True) # Clave para WhatsApp
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True)
    
    appointments: Mapped[List["Appointment"]] = relationship("Appointment", back_populates="patient")

class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="scheduled") # scheduled, cancelled, completed

    doctor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("doctors.id"))
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"))

    doctor: Mapped["Doctor"] = relationship("Doctor", back_populates="appointments")
    patient: Mapped["Patient"] = relationship("Patient", back_populates="appointments")


class BotLesson(Base):
    """Tabla de "lecciones" que el médico le enseña al Bot sobre correcciones."""
    
    __tablename__ = "bot_knowledge_base"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pattern: Mapped[str] = mapped_column(String(500), nullable=False, index=True)  # Lo que el usuario dijo mal
    correct_action: Mapped[str] = mapped_column(Text, nullable=False)  # La corrección del médico
    category: Mapped[str] = mapped_column(String(50), nullable=False)  # 'intent', 'entity', 'tone', etc.
    doctor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("doctors.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    
    doctor: Mapped["Doctor"] = relationship("Doctor")