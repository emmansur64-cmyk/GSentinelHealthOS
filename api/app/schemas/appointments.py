"""Schemas para appointments (compatibilidad con Fase 1 - deprecated)."""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

# Estos schemas son para compatibilidad con código de Fase 1 (deprecated)


class AppointmentCreate(BaseModel):
    """Crear appointment."""
    slot_id: int
    patient_id: int

    class Config:
        from_attributes = True


class AppointmentResponse(BaseModel):
    """Respuesta de appointment."""
    id: int
    slot_id: int
    patient_id: int
    status: str

    class Config:
        from_attributes = True
