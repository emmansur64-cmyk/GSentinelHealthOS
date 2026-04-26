"""Endpoints administrativos para control operacional del bot."""

from __future__ import annotations

from contextlib import suppress
from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from api.app.core.security import InternalAuth, UserAuth, get_current_user, validate_api_key
from api.app.dependencies.auth import RoleChecker
from api.app.dependencies.db import get_db
from api.app.services.google_calendar_service import get_google_calendar_resilience_snapshot
from api.app.schemas.bot_lesson_schema import BotLessonCreate, BotLessonResponse
from api.app.schemas.time_slot_schemas_simple import (
    SpecialtyPriorityPolicyCreateRequest,
    SpecialtyPriorityPolicyUpdateRequest,
    SpecialtyPriorityPolicyResponse,
)
from brain.core.state_manager import StateManager
from shared.config import REDIS_URL
from api.app.models import Appointment, BotLesson, GoogleOutbox
from api.app.models.time_slot_simple import SpecialtyPriorityPolicy

router = APIRouter(prefix="/admin", tags=["admin"])
_role_guard = RoleChecker(["admin", "receptionist"])
_doctor_role_guard = RoleChecker(["admin", "doctor"])


class ToggleBotPauseRequest(BaseModel):
    phone: str = Field(..., min_length=3)
    pause: bool


class GoogleSyncAdminItem(BaseModel):
    appointment_id: uuid.UUID
    doctor_id: uuid.UUID
    patient_id: uuid.UUID
    date_time: datetime
    status: str
    google_event_id: str | None = None
    google_sync_status: str
    outbox_event_type: str | None = None
    outbox_status: str | None = None
    outbox_attempts: int | None = None
    outbox_next_attempt_at: datetime | None = None
    outbox_last_error: str | None = None


class GoogleSyncAdminResponse(BaseModel):
    items: list[GoogleSyncAdminItem]
    count: int
    sync_status: str


class GoogleCalendarResilienceAdminResponse(BaseModel):
    active_config: dict
    recommended_profiles: dict
    metrics: dict
    breaker: dict
    rate_limiter: dict


@router.post("/bot/toggle-pause", dependencies=[Depends(_role_guard)])
async def toggle_bot_pause(payload: ToggleBotPauseRequest) -> dict:
    redis_client = Redis.from_url(REDIS_URL, decode_responses=True)
    state_manager = StateManager(client=redis_client)
    try:
        await state_manager.toggle_bot_pause(payload.phone, payload.pause)
        return {
            "phone": payload.phone,
            "paused": payload.pause,
        }
    finally:
        with suppress(Exception):
            close_method = getattr(redis_client, "aclose", None)
            if close_method is not None:
                await close_method()
            else:
                await redis_client.close()


@router.post("/learn", dependencies=[Depends(_doctor_role_guard)], response_model=BotLessonResponse)
async def teach_bot_lesson(
    payload: BotLessonCreate,
    current_user: UserAuth = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BotLessonResponse:
    """
    Endpoint que permite a un médico enseñar al bot sobre correcciones específicas.
    
    El médico envía un "patrón" (lo que el usuario dijo mal) y la "corrección"
    que el bot debe aprender. Esto se guarda en la base de datos para futuras
    interacciones.
    """
    # Obtener el doctor_id del usuario actual
    doctor_id_str = current_user.doctor_id
    if not doctor_id_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario actual no está asociado a un consultorio"
        )
    
    try:
        doctor_id = uuid.UUID(doctor_id_str)
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de médico inválido"
        )
    
    # Crear la lección
    lesson = BotLesson(
        pattern=payload.pattern,
        correct_action=payload.correct_action,
        category=payload.category,
        doctor_id=doctor_id,
    )
    
    db.add(lesson)
    await db.commit()
    await db.refresh(lesson)
    
    return BotLessonResponse.model_validate(lesson)


@router.get("/lessons/{doctor_id}", response_model=list[BotLessonResponse])
async def get_bot_lessons(
    doctor_id: str,
    _service_auth: InternalAuth = Depends(validate_api_key),
    db: AsyncSession = Depends(get_db),
) -> list[BotLessonResponse]:
    """
    Obtiene todas las lecciones para un doctor específico.
    
    Este endpoint es utilizado por el Brain para inyectar las lecciones
    del médico en el análisis de NLU.
    
    Acceso: Servicios internos (Gateway, Brain)
    """
    try:
        doctor_uuid = uuid.UUID(doctor_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de médico inválido"
        )
    
    stmt = select(BotLesson).where(
        BotLesson.doctor_id == doctor_uuid
    ).order_by(BotLesson.created_at.desc())
    
    result = await db.execute(stmt)
    lessons = result.scalars().all()
    
    return [BotLessonResponse.model_validate(lesson) for lesson in lessons]


@router.get(
    "/specialty-priority-policy",
    dependencies=[Depends(_role_guard)],
    response_model=list[SpecialtyPriorityPolicyResponse],
)
async def list_specialty_priority_policies(
    specialty: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[SpecialtyPriorityPolicyResponse]:
    stmt = select(SpecialtyPriorityPolicy).order_by(SpecialtyPriorityPolicy.specialty.asc())
    if specialty:
        stmt = stmt.where(SpecialtyPriorityPolicy.specialty == specialty.strip())

    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [SpecialtyPriorityPolicyResponse.model_validate(row) for row in rows]


@router.get(
    "/specialty-priority-policy/{policy_id}",
    dependencies=[Depends(_role_guard)],
    response_model=SpecialtyPriorityPolicyResponse,
)
async def get_specialty_priority_policy(
    policy_id: int,
    db: AsyncSession = Depends(get_db),
) -> SpecialtyPriorityPolicyResponse:
    row = await db.get(SpecialtyPriorityPolicy, policy_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Policy not found")
    return SpecialtyPriorityPolicyResponse.model_validate(row)


@router.post(
    "/specialty-priority-policy",
    dependencies=[Depends(_role_guard)],
    response_model=SpecialtyPriorityPolicyResponse,
    status_code=201,
)
async def create_specialty_priority_policy(
    payload: SpecialtyPriorityPolicyCreateRequest,
    db: AsyncSession = Depends(get_db),
) -> SpecialtyPriorityPolicyResponse:
    specialty_name = payload.specialty.strip()
    if not specialty_name:
        raise HTTPException(status_code=400, detail="specialty is required")

    policy = SpecialtyPriorityPolicy(
        specialty=specialty_name,
        allow_urgent_reassign=payload.allow_urgent_reassign,
        urgent_sla_target_minutes=payload.urgent_sla_target_minutes,
    )
    db.add(policy)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Policy already exists for this specialty") from exc

    await db.refresh(policy)
    return SpecialtyPriorityPolicyResponse.model_validate(policy)


@router.put(
    "/specialty-priority-policy/{policy_id}",
    dependencies=[Depends(_role_guard)],
    response_model=SpecialtyPriorityPolicyResponse,
)
async def update_specialty_priority_policy(
    policy_id: int,
    payload: SpecialtyPriorityPolicyUpdateRequest,
    db: AsyncSession = Depends(get_db),
) -> SpecialtyPriorityPolicyResponse:
    row = await db.get(SpecialtyPriorityPolicy, policy_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Policy not found")

    if payload.allow_urgent_reassign is not None:
        row.allow_urgent_reassign = payload.allow_urgent_reassign
    if payload.urgent_sla_target_minutes is not None:
        row.urgent_sla_target_minutes = payload.urgent_sla_target_minutes

    await db.commit()
    await db.refresh(row)
    return SpecialtyPriorityPolicyResponse.model_validate(row)


@router.delete(
    "/specialty-priority-policy/{policy_id}",
    dependencies=[Depends(_role_guard)],
    status_code=204,
    response_class=Response,
)
async def delete_specialty_priority_policy(
    policy_id: int,
    db: AsyncSession = Depends(get_db),
) -> Response:
    row = await db.get(SpecialtyPriorityPolicy, policy_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Policy not found")

    await db.delete(row)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/google-sync-appointments",
    dependencies=[Depends(_role_guard)],
    response_model=GoogleSyncAdminResponse,
)
async def list_google_sync_appointments(
    sync_status: str = Query("failed", description="pending | failed | synced"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> GoogleSyncAdminResponse:
    normalized_status = sync_status.strip().lower()
    if normalized_status not in {"pending", "failed", "synced"}:
        raise HTTPException(status_code=400, detail="sync_status must be one of: pending, failed, synced")

    appointment_rows = list(
        (
            await db.execute(
                select(Appointment)
                .where(Appointment.google_sync_status == normalized_status)
                .order_by(Appointment.date_time.desc())
                .limit(limit)
            )
        ).scalars().all()
    )

    appointment_ids = [row.id for row in appointment_rows]
    latest_outbox_by_appointment: dict[uuid.UUID, GoogleOutbox] = {}

    if appointment_ids:
        outbox_rows = list(
            (
                await db.execute(
                    select(GoogleOutbox)
                    .where(GoogleOutbox.appointment_id.in_(appointment_ids))
                    .order_by(
                        GoogleOutbox.appointment_id.asc(),
                        GoogleOutbox.created_at.desc(),
                    )
                )
            ).scalars().all()
        )

        for item in outbox_rows:
            appointment_id = item.appointment_id
            if appointment_id not in latest_outbox_by_appointment:
                latest_outbox_by_appointment[appointment_id] = item

    items = [
        GoogleSyncAdminItem(
            appointment_id=row.id,
            doctor_id=row.doctor_id,
            patient_id=row.patient_id,
            date_time=row.date_time,
            status=row.status,
            google_event_id=row.google_event_id,
            google_sync_status=row.google_sync_status,
            outbox_event_type=latest_outbox_by_appointment.get(row.id).action if latest_outbox_by_appointment.get(row.id) else None,
            outbox_status=latest_outbox_by_appointment.get(row.id).status if latest_outbox_by_appointment.get(row.id) else None,
            outbox_attempts=latest_outbox_by_appointment.get(row.id).retries if latest_outbox_by_appointment.get(row.id) else None,
            outbox_next_attempt_at=latest_outbox_by_appointment.get(row.id).next_attempt_at if latest_outbox_by_appointment.get(row.id) else None,
            outbox_last_error=latest_outbox_by_appointment.get(row.id).last_error if latest_outbox_by_appointment.get(row.id) else None,
        )
        for row in appointment_rows
    ]

    return GoogleSyncAdminResponse(
        items=items,
        count=len(items),
        sync_status=normalized_status,
    )


@router.get(
    "/google-calendar-resilience",
    dependencies=[Depends(_role_guard)],
    response_model=GoogleCalendarResilienceAdminResponse,
)
async def google_calendar_resilience_admin() -> GoogleCalendarResilienceAdminResponse:
    snapshot = await get_google_calendar_resilience_snapshot()
    return GoogleCalendarResilienceAdminResponse(
        active_config=snapshot.get("active_config", {}),
        recommended_profiles=snapshot.get("recommended_profiles", {}),
        metrics=snapshot.get("metrics", {}),
        breaker=snapshot.get("breaker", {}),
        rate_limiter=snapshot.get("rate_limiter", {}),
    )