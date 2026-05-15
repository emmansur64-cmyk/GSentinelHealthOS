"""Schemas Pydantic v2 compartidos."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from shared.models import AppointmentStatus


# ============ PATIENT SCHEMAS ============

class PatientBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(..., min_length=2, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, pattern=r"^\+?[1-9]\d{7,14}$")
    date_of_birth: Optional[datetime] = None
    medical_history: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("date_of_birth")
    @classmethod
    def validate_dob_in_past(cls, value: Optional[datetime]) -> Optional[datetime]:
        if value is not None and value > datetime.utcnow():
            raise ValueError("date_of_birth debe estar en el pasado")
        return value


class PatientCreate(PatientBase):
    pass


class PatientUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, pattern=r"^\+?[1-9]\d{7,14}$")
    date_of_birth: Optional[datetime] = None
    medical_history: Optional[str] = Field(default=None, max_length=2000)


class PatientResponse(PatientBase):
    id: uuid.UUID
    full_name: Optional[str] = None
    dni: Optional[str] = None
    age: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class WhatsAppPatientUpsert(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    full_name: str = Field(..., min_length=3, max_length=255)
    dni: str = Field(..., pattern=r"^\d{7,9}$")
    phone: str = Field(..., pattern=r"^\+?[1-9]\d{7,14}$")
    email: Optional[EmailStr] = None
    age: int = Field(..., ge=0, le=120)


# ============ DOCTOR SCHEMAS ============

class DoctorBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    specialty: str = Field(..., min_length=2, max_length=120)
    phone: Optional[str] = Field(default=None, pattern=r"^\+?[1-9]\d{7,14}$")
    license_number: str = Field(..., min_length=4, max_length=80)
    is_active: bool = True


class DoctorCreate(DoctorBase):
    pass


class DoctorUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    email: Optional[EmailStr] = None
    specialty: Optional[str] = Field(default=None, min_length=2, max_length=120)
    phone: Optional[str] = Field(default=None, pattern=r"^\+?[1-9]\d{7,14}$")
    license_number: Optional[str] = Field(default=None, min_length=4, max_length=80)
    is_active: Optional[bool] = None


class DoctorResponse(DoctorBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ============ APPOINTMENT SCHEMAS ============

class AppointmentBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    appointment_date: datetime
    reason: Optional[str] = Field(default=None, max_length=1000)
    notes: Optional[str] = Field(default=None, max_length=4000)

    @field_validator("appointment_date")
    @classmethod
    def validate_future_appointment(cls, value: datetime) -> datetime:
        if value <= datetime.utcnow():
            raise ValueError("appointment_date debe ser futura")
        return value


class AppointmentCreate(AppointmentBase):
    pass


class AppointmentUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    patient_id: Optional[uuid.UUID] = None
    doctor_id: Optional[uuid.UUID] = None
    appointment_date: Optional[datetime] = None
    reason: Optional[str] = Field(default=None, max_length=1000)
    notes: Optional[str] = Field(default=None, max_length=4000)
    status: Optional[AppointmentStatus] = None


class AppointmentResponse(AppointmentBase):
    id: uuid.UUID
    status: AppointmentStatus
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class AppointmentWithDetailsResponse(AppointmentResponse):
    patient: PatientResponse
    doctor: DoctorResponse
