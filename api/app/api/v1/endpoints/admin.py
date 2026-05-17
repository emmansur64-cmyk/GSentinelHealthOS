"""Endpoints administrativos para control operacional del bot."""

from __future__ import annotations

from contextlib import suppress
from datetime import datetime
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
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
from shared.security.secrets import (
    MissingSecretEncryptionKeyError,
    SecretEncryptionError,
    decrypt_secret,
    encrypt_secret,
    is_secret_encryption_key_configured,
    sha256_hex,
)
from shared.utils import setup_logger
from api.app.models import Appointment, BotLesson, Client, ClientWhatsAppAccount, Clinic, GoogleOutbox
from api.app.models.time_slot_simple import SpecialtyPriorityPolicy

router = APIRouter(prefix="/admin", tags=["admin"])
logger = setup_logger(__name__)
_role_guard = RoleChecker(["admin", "receptionist"])
_doctor_role_guard = RoleChecker(["admin", "doctor"])
_admin_guard = RoleChecker(["admin"])
_DOCTOR_LESSON_NAMESPACE = uuid.UUID("8e8af5fb-143d-4d63-9b72-2d959f2b6b7f")
_RUNTIME_LESSONS_TABLE = "bot_knowledge_runtime"


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


class AdminClientCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    slug: str = Field(..., min_length=2, max_length=120)
    status: str = Field(default="active", min_length=2, max_length=20)


class AdminClientPatchRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    slug: str | None = Field(default=None, min_length=2, max_length=120)
    status: str | None = Field(default=None, min_length=2, max_length=20)


class AdminClientResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AdminClientWhatsAppCreateRequest(BaseModel):
    clinic_id: uuid.UUID | None = None
    provider: str = Field(default="meta", min_length=2, max_length=32)
    phone_number: str | None = Field(default=None, max_length=32)
    phone_number_id: str = Field(..., min_length=2, max_length=80)
    business_account_id: str | None = Field(default=None, max_length=80)
    meta_business_id: str | None = Field(default=None, max_length=80)
    waba_id: str | None = Field(default=None, max_length=80)
    display_phone_number: str | None = Field(default=None, max_length=32)
    access_token: str | None = None
    app_secret: str | None = None
    verify_token: str | None = Field(default=None, max_length=255)
    webhook_enabled: bool = True
    status: str = Field(default="active", min_length=2, max_length=20)


class AdminClientWhatsAppPatchRequest(BaseModel):
    clinic_id: uuid.UUID | None = None
    provider: str | None = Field(default=None, min_length=2, max_length=32)
    phone_number: str | None = Field(default=None, max_length=32)
    phone_number_id: str | None = Field(default=None, min_length=2, max_length=80)
    business_account_id: str | None = Field(default=None, max_length=80)
    meta_business_id: str | None = Field(default=None, max_length=80)
    waba_id: str | None = Field(default=None, max_length=80)
    display_phone_number: str | None = Field(default=None, max_length=32)
    access_token: str | None = None
    app_secret: str | None = None
    verify_token: str | None = Field(default=None, max_length=255)
    webhook_enabled: bool | None = None
    status: str | None = Field(default=None, min_length=2, max_length=20)


class AdminClientWhatsAppResponse(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    clinic_id: uuid.UUID | None
    provider: str
    phone_number: str | None
    phone_number_id: str
    business_account_id: str | None
    meta_business_id: str | None
    waba_id: str | None
    display_phone_number: str | None
    verify_token_masked: str | None
    access_token_masked: str | None
    app_secret_masked: str | None
    webhook_enabled: bool
    status: str
    created_at: datetime
    updated_at: datetime


def _normalize_slug(value: str) -> str:
    return value.strip().lower().replace(" ", "-")


def _mask_secret(value: str | None) -> str | None:
    if not value:
        return None
    if len(value) <= 8:
        return "*" * len(value)
    return f"{value[:4]}{'*' * (len(value) - 8)}{value[-4:]}"


def _mask_encrypted_secret(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return _mask_secret(decrypt_secret(value))
    except Exception:
        return "****"


def _ensure_token_write_allowed(has_sensitive_update: bool) -> None:
    if not has_sensitive_update:
        return
    if is_secret_encryption_key_configured():
        return

    if os.getenv("ENV", "development").strip().lower() == "production":
        raise HTTPException(
            status_code=503,
            detail="SECRET_ENCRYPTION_KEY faltante en producción; escritura de tokens bloqueada",
        )

    raise HTTPException(
        status_code=400,
        detail="SECRET_ENCRYPTION_KEY faltante; configurela para guardar tokens",
    )


def _raise_whatsapp_secret_error(exc: Exception) -> None:
    logger.error("Error procesando credenciales de WhatsApp: %s", exc, exc_info=True)
    raise HTTPException(
        status_code=400,
        detail="No se pudieron procesar las credenciales de WhatsApp",
    )


def _to_admin_whatsapp_response(account: ClientWhatsAppAccount) -> AdminClientWhatsAppResponse:
    return AdminClientWhatsAppResponse(
        id=account.id,
        client_id=account.client_id,
        clinic_id=account.clinic_id,
        provider=account.provider,
        phone_number=account.phone_number,
        phone_number_id=account.phone_number_id,
        business_account_id=account.business_account_id,
        meta_business_id=account.meta_business_id,
        waba_id=account.waba_id,
        display_phone_number=account.display_phone_number,
        verify_token_masked=_mask_secret(account.verify_token),
        access_token_masked=_mask_encrypted_secret(account.access_token_encrypted),
        app_secret_masked=_mask_encrypted_secret(account.app_secret_encrypted),
        webhook_enabled=account.webhook_enabled,
        status=account.status,
        created_at=account.created_at,
        updated_at=account.updated_at,
    )


def _normalize_doctor_uuid(doctor_id_raw: str) -> uuid.UUID:
    """Normaliza identificador de medico a UUID estable.

    Acepta UUID nativo o string legacy (ej: "lab-doctor") y mapea legacy a UUID5
    deterministico para mantener consistencia de lectura/escritura.
    """
    doctor_id_clean = str(doctor_id_raw or "").strip()
    if not doctor_id_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de médico inválido",
        )
    try:
        return uuid.UUID(doctor_id_clean)
    except (ValueError, TypeError):
        return uuid.uuid5(_DOCTOR_LESSON_NAMESPACE, doctor_id_clean.lower())


async def _create_bot_lesson_record(
    *,
    db: AsyncSession,
    doctor_id: uuid.UUID,
    payload: BotLessonCreate,
) -> dict:
    lesson_id = uuid.uuid4()
    now = datetime.utcnow()
    try:
        await db.execute(
            text(
                f"""
                INSERT INTO {_RUNTIME_LESSONS_TABLE}
                (id, pattern, correct_action, category, doctor_id, created_at, updated_at)
                VALUES (:id, :pattern, :correct_action, :category, :doctor_id, :created_at, :updated_at)
                """
            ),
            {
                "id": lesson_id,
                "pattern": payload.pattern,
                "correct_action": payload.correct_action,
                "category": payload.category,
                "doctor_id": doctor_id,
                "created_at": now,
                "updated_at": now,
            },
        )
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una lección con este patrón para este médico",
        )
    return {
        "id": lesson_id,
        "pattern": payload.pattern,
        "correct_action": payload.correct_action,
        "category": payload.category,
        "doctor_id": doctor_id,
        "created_at": now,
        "updated_at": now,
    }


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
    
    doctor_id = _normalize_doctor_uuid(doctor_id_str)
    lesson = await _create_bot_lesson_record(db=db, doctor_id=doctor_id, payload=payload)
    return BotLessonResponse.model_validate(lesson)


@router.post("/lessons/{doctor_id}", response_model=BotLessonResponse)
async def create_bot_lesson_internal(
    doctor_id: str,
    payload: BotLessonCreate,
    _service_auth: InternalAuth = Depends(validate_api_key),
    db: AsyncSession = Depends(get_db),
) -> BotLessonResponse:
    """Alta interna de lecciones para aprendizaje continuo desde servicios."""
    doctor_uuid = _normalize_doctor_uuid(doctor_id)
    lesson = await _create_bot_lesson_record(db=db, doctor_id=doctor_uuid, payload=payload)
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
    doctor_uuid = _normalize_doctor_uuid(doctor_id)
    
    result = await db.execute(
        text(
            f"""
            SELECT id, pattern, correct_action, category, doctor_id, created_at, updated_at
            FROM {_RUNTIME_LESSONS_TABLE}
            WHERE doctor_id = :doctor_id
            ORDER BY created_at DESC
            """
        ),
        {"doctor_id": doctor_uuid},
    )
    rows = result.mappings().all()
    return [BotLessonResponse.model_validate(dict(row)) for row in rows]


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


@router.post(
    "/clients",
    dependencies=[Depends(_admin_guard)],
    response_model=AdminClientResponse,
    status_code=201,
)
async def create_client(
    payload: AdminClientCreateRequest,
    db: AsyncSession = Depends(get_db),
) -> AdminClientResponse:
    client = Client(
        name=payload.name.strip(),
        slug=_normalize_slug(payload.slug),
        status=payload.status.strip().lower(),
    )
    db.add(client)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Client slug already exists") from exc

    await db.refresh(client)
    return AdminClientResponse.model_validate(client)


@router.get(
    "/clients",
    dependencies=[Depends(_admin_guard)],
    response_model=list[AdminClientResponse],
)
async def list_clients(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
) -> list[AdminClientResponse]:
    rows = list((await db.execute(select(Client).order_by(Client.created_at.desc()).offset(skip).limit(limit))).scalars().all())
    return [AdminClientResponse.model_validate(row) for row in rows]


@router.get(
    "/clients/{client_id}",
    dependencies=[Depends(_admin_guard)],
    response_model=AdminClientResponse,
)
async def get_client(
    client_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> AdminClientResponse:
    row = await db.get(Client, client_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return AdminClientResponse.model_validate(row)


@router.patch(
    "/clients/{client_id}",
    dependencies=[Depends(_admin_guard)],
    response_model=AdminClientResponse,
)
async def patch_client(
    client_id: uuid.UUID,
    payload: AdminClientPatchRequest,
    db: AsyncSession = Depends(get_db),
) -> AdminClientResponse:
    row = await db.get(Client, client_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Client not found")

    if payload.name is not None:
        row.name = payload.name.strip()
    if payload.slug is not None:
        row.slug = _normalize_slug(payload.slug)
    if payload.status is not None:
        row.status = payload.status.strip().lower()

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Client slug already exists") from exc

    await db.refresh(row)
    return AdminClientResponse.model_validate(row)


@router.post(
    "/clients/{client_id}/whatsapp",
    dependencies=[Depends(_admin_guard)],
    response_model=AdminClientWhatsAppResponse,
    status_code=201,
)
async def create_client_whatsapp_account(
    client_id: uuid.UUID,
    payload: AdminClientWhatsAppCreateRequest,
    db: AsyncSession = Depends(get_db),
) -> AdminClientWhatsAppResponse:
    client_row = await db.get(Client, client_id)
    if client_row is None:
        raise HTTPException(status_code=404, detail="Client not found")
    if payload.clinic_id is not None:
        clinic_row = await db.get(Clinic, payload.clinic_id)
        if clinic_row is None or clinic_row.client_id != client_id:
            raise HTTPException(status_code=400, detail="clinic_id does not belong to client")

    existing_stmt = select(ClientWhatsAppAccount).where(ClientWhatsAppAccount.client_id == client_id)
    if payload.clinic_id is not None:
        existing_stmt = existing_stmt.where(ClientWhatsAppAccount.clinic_id == payload.clinic_id)
    existing = (await db.execute(existing_stmt.order_by(ClientWhatsAppAccount.created_at.desc()))).scalars().first()
    if existing is not None:
        raise HTTPException(status_code=409, detail="WhatsApp account already exists for this scope")

    has_sensitive_update = bool(payload.access_token or payload.app_secret)
    _ensure_token_write_allowed(has_sensitive_update)

    try:
        access_token_encrypted = encrypt_secret(payload.access_token) if payload.access_token else None
        app_secret_encrypted = encrypt_secret(payload.app_secret) if payload.app_secret else None
    except MissingSecretEncryptionKeyError as exc:
        _raise_whatsapp_secret_error(exc)
    except SecretEncryptionError as exc:
        _raise_whatsapp_secret_error(exc)

    account = ClientWhatsAppAccount(
        client_id=client_id,
        clinic_id=payload.clinic_id,
        provider=payload.provider.strip().lower(),
        phone_number=payload.phone_number,
        phone_number_id=payload.phone_number_id.strip(),
        business_account_id=payload.business_account_id,
        meta_business_id=payload.meta_business_id,
        waba_id=payload.waba_id,
        display_phone_number=payload.display_phone_number,
        access_token_encrypted=access_token_encrypted,
        app_secret_encrypted=app_secret_encrypted,
        verify_token=sha256_hex(payload.verify_token) if payload.verify_token else None,
        webhook_enabled=payload.webhook_enabled,
        status=payload.status.strip().lower(),
    )

    db.add(account)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="phone_number_id already in use") from exc

    await db.refresh(account)
    return _to_admin_whatsapp_response(account)


@router.get(
    "/clients/{client_id}/whatsapp",
    dependencies=[Depends(_admin_guard)],
    response_model=AdminClientWhatsAppResponse,
)
async def get_client_whatsapp_account(
    client_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> AdminClientWhatsAppResponse:
    row = (
        await db.execute(
            select(ClientWhatsAppAccount)
            .where(ClientWhatsAppAccount.client_id == client_id)
            .order_by(ClientWhatsAppAccount.updated_at.desc())
        )
    ).scalars().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Client WhatsApp account not found")

    return _to_admin_whatsapp_response(row)


@router.patch(
    "/clients/{client_id}/whatsapp",
    dependencies=[Depends(_admin_guard)],
    response_model=AdminClientWhatsAppResponse,
)
async def patch_client_whatsapp_account(
    client_id: uuid.UUID,
    payload: AdminClientWhatsAppPatchRequest,
    db: AsyncSession = Depends(get_db),
) -> AdminClientWhatsAppResponse:
    row = (
        await db.execute(
            select(ClientWhatsAppAccount)
            .where(ClientWhatsAppAccount.client_id == client_id)
            .order_by(ClientWhatsAppAccount.updated_at.desc())
        )
    ).scalars().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Client WhatsApp account not found")
    if payload.clinic_id is not None:
        clinic_row = await db.get(Clinic, payload.clinic_id)
        if clinic_row is None or clinic_row.client_id != client_id:
            raise HTTPException(status_code=400, detail="clinic_id does not belong to client")

    has_sensitive_update = bool(payload.access_token or payload.app_secret)
    _ensure_token_write_allowed(has_sensitive_update)

    if payload.provider is not None:
        row.provider = payload.provider.strip().lower()
    if payload.clinic_id is not None:
        row.clinic_id = payload.clinic_id
    if payload.phone_number is not None:
        row.phone_number = payload.phone_number
    if payload.phone_number_id is not None:
        row.phone_number_id = payload.phone_number_id.strip()
    if payload.business_account_id is not None:
        row.business_account_id = payload.business_account_id
    if payload.meta_business_id is not None:
        row.meta_business_id = payload.meta_business_id
    if payload.waba_id is not None:
        row.waba_id = payload.waba_id
    if payload.display_phone_number is not None:
        row.display_phone_number = payload.display_phone_number
    if payload.verify_token is not None:
        row.verify_token = sha256_hex(payload.verify_token)
    if payload.webhook_enabled is not None:
        row.webhook_enabled = payload.webhook_enabled
    if payload.status is not None:
        row.status = payload.status.strip().lower()

    try:
        if payload.access_token is not None:
            row.access_token_encrypted = encrypt_secret(payload.access_token)
        if payload.app_secret is not None:
            row.app_secret_encrypted = encrypt_secret(payload.app_secret)
    except MissingSecretEncryptionKeyError as exc:
        _raise_whatsapp_secret_error(exc)
    except SecretEncryptionError as exc:
        _raise_whatsapp_secret_error(exc)

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="phone_number_id already in use") from exc

    await db.refresh(row)
    return _to_admin_whatsapp_response(row)
