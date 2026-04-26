"""Schemas para el endpoint de estadísticas del dashboard."""

from __future__ import annotations

from typing import Optional
from pydantic import Field

from .base_schema import BaseSchema


class BotHealth(BaseSchema):
    resets: int = Field(0, description="Total de reinicios del sistema brain")
    contention: int = Field(0, description="Total de contentions de lock")
    messages_processed: int = Field(0, description="Total de mensajes procesados")
    reset_ratio: float = Field(0.0, description="Ratio resets/procesados")
    contention_ratio: float = Field(0.0, description="Ratio contentions/procesados")


class QueueHealth(BaseSchema):
    incoming: Optional[int] = Field(None, description="Profundidad cola whatsapp:incoming")
    outgoing: Optional[int] = Field(None, description="Profundidad cola whatsapp:outgoing")
    backlog_high: bool = Field(False, description="True si alguna cola supera el umbral configurado")


class Alerts(BaseSchema):
    lock_contention_high: bool = False
    queue_backlog_high: bool = False
    system_reset_ratio_high: bool = False


class RecentAppointment(BaseSchema):
    appointment_id: str
    doctor_id: str = ""
    doctor_name: str = "Sin asignar"
    specialty: str = "General"
    patient_name: str
    patient_phone: str
    channel: str = "whatsapp"
    sla_minutes: int = 30
    date_time: str
    status: str
    bot_paused: bool = False


class DashboardStats(BaseSchema):
    appointments_today: int = Field(0, description="Citas programadas o activas para hoy")
    pending_actions: int = Field(0, description="Notificaciones en Outbox pendientes")
    paused_chats: int = Field(0, description="Chats con bot pausado que requieren atencion manual")
    recent_appointments: list[RecentAppointment] = Field(
        default_factory=list,
        description="Listado de citas recientes para tabla de dashboard",
    )
    bot_health: BotHealth
    queue_health: QueueHealth
    alerts: Alerts
    redis_connected: bool
    health_status: str = Field("optimal", description="optimal | warning | critical")
    status: str = Field("operational", description="Estado general del sistema")
    timestamp: str
