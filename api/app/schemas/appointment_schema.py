"""Esquemas de cita médica (Appointment) con validaciones de negocio."""

from datetime import datetime
from typing import Optional
import uuid

from pydantic import Field, EmailStr, field_validator

from .base_schema import BaseSchema


class PatientBase(BaseSchema):
    """Base schema para paciente con validaciones E.164 para WhatsApp."""

    name: str = Field(
        ..., 
        min_length=3, 
        max_length=100,
        description="Nombre completo del paciente"
    )
    
    # Validación E.164: permite +1-9, luego 1-14 dígitos
    # Ej: +34912345678, +12025551234, +551140414000
    phone: str = Field(
        ..., 
        pattern=r"^\+?[1-9]\d{1,14}$",
        description="Teléfono en formato E.164 (ej: +34912345678)"
    )
    
    email: Optional[EmailStr] = Field(
        None,
        description="Email del paciente (validación RFC 5322)"
    )

    @field_validator("phone")
    @classmethod
    def validate_phone_format(cls, v: str) -> str:
        """Valida que el teléfono sea procesable por Gateway WhatsApp."""
        if not v.startswith("+"):
            raise ValueError("Teléfono debe incluir prefijo de país (ej: +34)")
        return v


class AppointmentBase(BaseSchema):
    """Base schema para cita médica."""

    date_time: datetime = Field(
        ...,
        description="Fecha y hora de la cita"
    )
    
    reason: Optional[str] = Field(
        None,
        max_length=500,
        description="Razón de la cita"
    )
    
    status: str = Field(
        default="scheduled",
        description="Estado de la cita (scheduled, pending, completed, cancelled, reprogrammed)"
    )

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        """Valida que el estado sea uno de los permitidos."""
        allowed = {"scheduled", "completed", "cancelled", "pending", "reprogrammed"}
        if v not in allowed:
            raise ValueError(f"estado debe ser uno de: {allowed}")
        return v


class AppointmentCreate(AppointmentBase):
    """Schema para crear una nueva cita."""

    doctor_id: uuid.UUID = Field(
        ...,
        description="ID único del doctor"
    )
    
    patient_id: uuid.UUID = Field(
        ...,
        description="ID único del paciente"
    )


class AppointmentResponse(AppointmentBase):
    """Schema para respuesta de cita (incluye ID)."""

    id: uuid.UUID = Field(
        ...,
        description="ID único de la cita"
    )
    
    doctor_id: uuid.UUID = Field(
        ...,
        description="ID del doctor asignado"
    )
    
    patient_id: uuid.UUID = Field(
        ...,
        description="ID del paciente"
    )

    google_event_id: Optional[str] = Field(
        None,
        description="ID del evento en Google Calendar"
    )

    google_sync_status: str = Field(
        default="pending",
        description="Estado de sincronizacion Google Calendar: pending | synced | failed"
    )
