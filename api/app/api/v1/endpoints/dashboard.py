"""Endpoint de estadísticas del dashboard ejecutivo."""

from __future__ import annotations

from contextlib import suppress
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.app.core.config import settings
from api.app.core.security import UserAuth, get_current_user
from api.app.dependencies.auth import RoleChecker
from api.app.dependencies.db import get_db
from api.app.observability.health_metrics import build_health_observability
from api.app.schemas.dashboard_schema import (
    Alerts,
    BotHealth,
    DashboardStats,
    QueueHealth,
    RecentAppointment,
)
from brain.core.state_manager import StateManager
from shared.config import REDIS_URL

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


async def _fetch_redis_metrics() -> tuple[dict, dict, bool]:
    """Recoge métricas de Redis. Devuelve (queue_depths, brain_metrics, connected)."""
    queue_depths: dict = {"whatsapp_incoming": None, "whatsapp_outgoing": None, "booking_shards": {}}
    brain_metrics: dict = {
        "system_reset_total": 0,
        "lock_contention_total": 0,
        "messages_processed_total": 0,
    }
    redis_connected = False

    redis_client = Redis.from_url(REDIS_URL, decode_responses=True)
    try:
        pipe = redis_client.pipeline()
        pipe.llen("whatsapp:incoming")
        pipe.llen("whatsapp:outgoing")
        pipe.get("brain:metrics:system_reset_total")
        pipe.get("brain:metrics:lock_contention_total")
        pipe.get("brain:metrics:messages_processed_total")
        incoming, outgoing, resets, contention, processed = await pipe.execute()
        queue_depths["whatsapp_incoming"] = int(incoming)
        queue_depths["whatsapp_outgoing"] = int(outgoing)

        pipe_booking = redis_client.pipeline()
        for shard in range(max(1, settings.booking_queue_shards)):
            pipe_booking.llen(f"appointments:booking:shard:{shard}")
        booking_depths = await pipe_booking.execute()
        for shard, depth in enumerate(booking_depths):
            queue_depths["booking_shards"][str(shard)] = int(depth)

        brain_metrics["system_reset_total"] = int(resets) if resets else 0
        brain_metrics["lock_contention_total"] = int(contention) if contention else 0
        brain_metrics["messages_processed_total"] = int(processed) if processed else 0
        redis_connected = True
    except Exception:
        pass
    finally:
        with suppress(Exception):
            close_fn = getattr(redis_client, "aclose", None) or redis_client.close
            await close_fn()

    return queue_depths, brain_metrics, redis_connected


async def _fetch_pause_state(phones: list[str]) -> tuple[dict[str, bool], int]:
    pause_map = {phone: False for phone in phones}
    redis_client = Redis.from_url(REDIS_URL, decode_responses=True)
    state_manager = StateManager(client=redis_client)
    try:
        paused_total = await state_manager.count_paused_bots()
        if not phones:
            return pause_map, paused_total

        pipe = redis_client.pipeline()
        for phone in phones:
            pipe.exists(f"bot_paused:{phone}")
        results = await pipe.execute()
        for phone, paused in zip(phones, results):
            pause_map[phone] = bool(paused)
        return pause_map, paused_total
    except Exception:
        return pause_map, 0
    finally:
        with suppress(Exception):
            close_fn = getattr(redis_client, "aclose", None) or redis_client.close
            await close_fn()


_role_guard = RoleChecker(["admin", "receptionist", "doctor"])


@router.get(
    "/stats",
    response_model=DashboardStats,
    dependencies=[Depends(_role_guard)],
)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    user: UserAuth = Depends(get_current_user),
) -> DashboardStats:
    """Resumen ejecutivo consolidado para el dashboard de control."""

    doctor_scope_id: Optional[int] = None
    if user.role == "doctor" and user.doctor_id:
        try:
            doctor_scope_id = int(user.doctor_id)
        except ValueError:
            doctor_scope_id = None

    # --- Citas de hoy (zona UTC) ---
    today = datetime.utcnow().date()
    today_sql = """
        SELECT COUNT(a.id)
        FROM appointments a
        JOIN time_slots ts ON ts.id = a.slot_id
        WHERE CAST(ts.start_time AS DATE) = :today
    """
    today_params: dict[str, object] = {"today": today}
    if doctor_scope_id is not None:
        today_sql += " AND ts.doctor_id = :doctor_id"
        today_params["doctor_id"] = doctor_scope_id
    res = await db.execute(text(today_sql), today_params)
    appointments_today: int = int(res.scalar() or 0)

    # --- Outbox pendiente (acciones que requieren atención) ---
    res_pending = await db.execute(
        text("SELECT COUNT(id) FROM notification_outbox WHERE status = 'pending'")
    )
    pending_actions: int = int(res_pending.scalar() or 0)

    # --- Citas recientes para tabla de control ---
    recent_sql = """
        SELECT
            a.id,
            ts.doctor_id,
            ts.start_time,
            a.status,
            d.name AS doctor_name,
            NULL::text AS doctor_specialization,
            p.name AS patient_name,
            NULL::text AS patient_phone,
            30 AS duration_minutes,
            NULL::text AS created_by
        FROM appointments a
        LEFT JOIN patients p ON p.id = a.patient_id
        LEFT JOIN time_slots ts ON ts.id = a.slot_id
        LEFT JOIN doctors d ON d.id = ts.doctor_id
    """
    recent_params: dict[str, object] = {}
    if doctor_scope_id is not None:
        recent_sql += " WHERE ts.doctor_id = :doctor_id"
        recent_params["doctor_id"] = doctor_scope_id

    recent_sql += " ORDER BY ts.start_time DESC NULLS LAST LIMIT 8"

    res_recent = await db.execute(text(recent_sql), recent_params)
    recent_rows = res_recent.all()
    recent_phones = [phone for _, _, _, _, _, _, _, phone, _, _ in recent_rows if phone]
    pause_map, paused_chats = await _fetch_pause_state(recent_phones)
    recent_appointments = []
    for (
        appt_id,
        appt_doctor_id,
        appt_date_time,
        appt_status,
        doctor_name,
        doctor_specialization,
        patient_name,
        patient_phone,
        duration_minutes,
        created_by,
    ) in recent_rows:
        normalized_phone = patient_phone or ""
        recent_appointments.append(
            RecentAppointment(
                appointment_id=str(appt_id),
                doctor_id=str(appt_doctor_id) if appt_doctor_id else "",
                doctor_name=doctor_name or "Sin asignar",
                specialty=doctor_specialization or "General",
                patient_name=patient_name or f"Paciente {str(appt_id)[:8]}",
                patient_phone=normalized_phone,
                channel="whatsapp" if (created_by or "").lower() in {"gateway", "brain"} else "panel",
                sla_minutes=int(duration_minutes) if str(duration_minutes).isdigit() else 30,
                date_time=(appt_date_time.isoformat() if appt_date_time else datetime.utcnow().isoformat()),
                status=appt_status or "scheduled",
                bot_paused=pause_map.get(normalized_phone, False),
            )
        )

    # --- Métricas Redis ---
    queue_depths, brain_metrics, redis_connected = await _fetch_redis_metrics()

    observability = build_health_observability(
        redis_connected=redis_connected,
        queue_depths=queue_depths,
        brain_metrics=brain_metrics,
        lock_contention_threshold=settings.health_lock_contention_threshold,
        queue_backlog_threshold=settings.health_queue_backlog_threshold,
        reset_ratio_threshold=settings.health_reset_ratio_threshold,
    )

    resets = brain_metrics["system_reset_total"]
    any_alert = any(observability["alerts"].values())
    health_status = "optimal" if resets < 10 and not any_alert else "warning"

    return DashboardStats(
        appointments_today=appointments_today,
        pending_actions=pending_actions,
        paused_chats=paused_chats,
        recent_appointments=recent_appointments,
        bot_health=BotHealth(
            resets=resets,
            contention=brain_metrics["lock_contention_total"],
            messages_processed=brain_metrics["messages_processed_total"],
            reset_ratio=observability["ratios"]["system_reset_per_processed"],
            contention_ratio=observability["ratios"]["lock_contention_per_processed"],
        ),
        queue_health=QueueHealth(
            incoming=queue_depths["whatsapp_incoming"],
            outgoing=queue_depths["whatsapp_outgoing"],
            backlog_high=observability["alerts"]["queue_backlog_high"],
        ),
        alerts=Alerts(**observability["alerts"]),
        redis_connected=redis_connected,
        health_status=health_status,
        status="operational",
        timestamp=datetime.utcnow().isoformat(),
    )
