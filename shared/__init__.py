"""Shared module con carga diferida para evitar side effects pesados."""

from __future__ import annotations

from importlib import import_module


_EXPORTS = {
    "Base": "shared.models",
    "Patient": "shared.models",
    "Doctor": "shared.models",
    "Appointment": "shared.models",
    "PatientCreate": "shared.schemas",
    "PatientUpdate": "shared.schemas",
    "PatientResponse": "shared.schemas",
    "DoctorCreate": "shared.schemas",
    "DoctorUpdate": "shared.schemas",
    "DoctorResponse": "shared.schemas",
    "AppointmentCreate": "shared.schemas",
    "AppointmentUpdate": "shared.schemas",
    "AppointmentResponse": "shared.schemas",
}


def __getattr__(name: str):
    if name not in _EXPORTS:
        raise AttributeError(f"module 'shared' has no attribute {name!r}")

    module = import_module(_EXPORTS[name])
    value = getattr(module, name)
    globals()[name] = value
    return value

__all__ = [
    # Models
    "Base",
    "Patient",
    "Doctor",
    "Appointment",
    # Schemas
    "PatientCreate",
    "PatientUpdate",
    "PatientResponse",
    "DoctorCreate",
    "DoctorUpdate",
    "DoctorResponse",
    "AppointmentCreate",
    "AppointmentUpdate",
    "AppointmentResponse",
]
