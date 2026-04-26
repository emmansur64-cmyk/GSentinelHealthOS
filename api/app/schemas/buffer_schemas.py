"""
Esquemas Pydantic para buffers de turnos.
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class BufferBookingRequest(BaseModel):
    """Solicitud de reserva con buffer automático."""
    slot_id: int = Field(..., description="ID del slot a reservar")
    patient_id: int = Field(..., description="ID del paciente")
    buffer_minutes: int = Field(default=0, ge=0, le=120, description="Minutos de buffer antes/después")


class BufferBookingResponse(BaseModel):
    """Respuesta de reserva con buffer."""
    success: bool = Field(..., description="Operación exitosa")
    appointment_id: Optional[int] = Field(None, description="ID de la cita creada")
    slots_blocked: int = Field(..., description="Cantidad de slots bloqueados por buffer")
    error: str = Field(default="", description="Mensaje de error si aplica")


class BufferCancellationRequest(BaseModel):
    """Solicitud de cancelación con liberación de buffer."""
    appointment_id: int = Field(..., description="ID de la cita a cancelar")
    buffer_minutes: int = Field(default=0, ge=0, le=120, description="Minutos de buffer a liberar")


class BufferCancellationResponse(BaseModel):
    """Respuesta de cancelación con buffer."""
    success: bool = Field(..., description="Operación exitosa")
    slot_id: Optional[int] = Field(None, description="ID del slot liberado")
    slots_unblocked: int = Field(..., description="Cantidad de slots desbloqueados")
    error: str = Field(default="", description="Mensaje de error si aplica")


class BufferImpactResponse(BaseModel):
    """Análisis del impacto de buffers en disponibilidad."""
    total_slots: int = Field(..., description="Total de slots en la fecha")
    available: int = Field(..., description="Slots disponibles")
    booked: int = Field(..., description="Slots reservados")
    blocked_by_buffer: int = Field(..., description="Slots bloqueados por buffers")
    buffer_impact_percent: float = Field(..., description="Porcentaje de reducción de disponibilidad")
    available_for_booking: int = Field(..., description="Slots realmente disponibles para usuario final")


class BufferIntegrityResponse(BaseModel):
    """Validación de integridad del sistema de buffers."""
    is_valid: bool = Field(..., description="Sistema íntegro")
    orphan_blocked_slots: int = Field(..., description="Slots bloqueados sin cita asociada")
    conflicting_buffers: int = Field(..., description="Buffers solapados")
    issues: List[str] = Field(default_factory=list, description="Listado de problemas detectados")


class AvailableSlotsResponse(BaseModel):
    """Slots disponibles con info de buffers."""
    slot_id: int = Field(..., description="ID del slot")
    doctor_id: int = Field(..., description="ID del doctor")
    start_time: datetime = Field(..., description="Hora inicio")
    end_time: datetime = Field(..., description="Hora fin")
    status: str = Field(..., description="Estado (available/blocked/booked)")
    is_buffer_affected: bool = Field(..., description="¿Afectado por buffer?")


class DoctorBufferConfigResponse(BaseModel):
    """Configuración de buffer para un doctor."""
    doctor_id: int = Field(..., description="ID del doctor")
    buffer_minutes: int = Field(..., description="Minutos de buffer configurados")
    effective_date: datetime = Field(..., description="Fecha efectiva de la configuración")
