"""Esquemas Pydantic 2.0 para la API."""

from .base_schema import BaseSchema
from .appointment_schema import (
    PatientBase,
    AppointmentBase,
    AppointmentCreate,
    AppointmentResponse,
)

__all__ = [
    "BaseSchema",
    "PatientBase",
    "AppointmentBase",
    "AppointmentCreate",
    "AppointmentResponse",
]
