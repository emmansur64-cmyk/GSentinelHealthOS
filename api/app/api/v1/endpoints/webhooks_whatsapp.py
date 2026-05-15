from __future__ import annotations

from datetime import datetime
import os
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from api.app.dependencies.db import get_db
from api.app.eventing.realtime_notifications import broadcast_realtime_event
from api.app.models import ClientWhatsAppAccount
from api.app.services.shadow_profile_service import ShadowProfileService
from api.app.services.whatsapp_webhook_service import WhatsAppWebhookService
from brain.contracts.core_contracts import (
    ContractValidationError,
    ModeGuardResult,
    default_forbidden_tools_for_mode,
    evaluate_mode_guard,
    validate_runtime_brain_request,
)
import httpx
from shared.config import WHATSAPP_ACCESS_TOKEN, WHATSAPP_APP_SECRET, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN
from shared.security.secrets import SecretEncryptionError, decrypt_secret
from shared.utils import setup_logger

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
logger = setup_logger(__name__)


def _env_flag(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _legacy_processing_enabled() -> bool:
    return _env_flag("ENABLE_PY_WHATSAPP_WEBHOOK_PROCESSING", default=False)


async def _require_legacy_processing_enabled() -> None:
    if not _legacy_processing_enabled():
        logger.warning("deprecated_whatsapp_webhook_blocked")
        raise HTTPException(status_code=410, detail="deprecated_whatsapp_webhook_disabled")


def _safe_external_body(body: str, *, max_length: int = 500) -> str:
    redacted = str(body or "")
    for marker in ("Authorization", "Bearer", "access_token", "app_secret"):
        if marker in redacted:
            redacted = redacted.replace(marker, f"{marker}[redacted-key]")
    if len(redacted) > max_length:
        return f"{redacted[:max_length]}...[truncated]"
    return redacted


def _tool_for_whatsapp_intent(intent: str) -> str | None:
    mapping = {
        "book_appointment": "appointment.search_availability",
        "reschedule_appointment": "appointment.search_availability",
        "cancel_appointment": "appointment.search_availability",
        "general_query": None,
    }
    return mapping.get(intent)


async def _send_whatsapp_reply(
    to_phone: str,
    message: str,
    *,
    phone_number_id: str | None = None,
    access_token: str | None = None,
) -> None:
    """Envía un mensaje de texto via WhatsApp Cloud API."""
    resolved_phone_number_id = (phone_number_id or WHATSAPP_PHONE_NUMBER_ID or "").strip()
    resolved_access_token = (access_token or WHATSAPP_ACCESS_TOKEN or "").strip()
    if not resolved_phone_number_id or not resolved_access_token:
        logger.warning("whatsapp_send_skipped_missing_credentials")
        return
    url = f"https://graph.facebook.com/v19.0/{resolved_phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": to_phone,
        "type": "text",
        "text": {"body": message},
    }
    headers = {"Authorization": f"Bearer {resolved_access_token}"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code != 200:
                logger.warning(
                    "whatsapp_send_failed",
                    extra={"status": resp.status_code, "body": _safe_external_body(resp.text)},
                )
            else:
                logger.info("whatsapp_reply_sent", extra={"to": to_phone, "phone_number_id": resolved_phone_number_id})
    except Exception as exc:
        logger.exception("whatsapp_send_error", extra={"error": str(exc)})


class WhatsAppWebhookAck(BaseModel):
    status: str
    intent: str | None = None
    clinic_id: str
    patient_id: str | None = None
    auto_reply: str | None = None
    received_at: str


@router.get("/whatsapp", dependencies=[Depends(_require_legacy_processing_enabled)])
async def verify_whatsapp_webhook(
    hub_mode: str | None = Query(default=None, alias="hub.mode"),
    hub_verify_token: str | None = Query(default=None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(default=None, alias="hub.challenge"),
) -> PlainTextResponse:
    """Handshake de verificacion requerido por Meta al registrar el webhook."""
    if not _legacy_processing_enabled():
        logger.warning("deprecated_whatsapp_webhook_verify_blocked")
        raise HTTPException(status_code=410, detail="deprecated_whatsapp_webhook_disabled")

    if hub_mode != "subscribe":
        raise HTTPException(status_code=403, detail="invalid_mode")

    if not WHATSAPP_VERIFY_TOKEN or hub_verify_token != WHATSAPP_VERIFY_TOKEN:
        logger.warning("webhook_verify_token_invalid")
        raise HTTPException(status_code=403, detail="invalid_verify_token")

    if not hub_challenge:
        raise HTTPException(status_code=400, detail="missing_challenge")

    logger.info("whatsapp_webhook_verified")
    return PlainTextResponse(content=hub_challenge, status_code=200)


@router.post(
    "/whatsapp",
    response_model=WhatsAppWebhookAck,
    dependencies=[Depends(_require_legacy_processing_enabled)],
)
async def receive_whatsapp_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> WhatsAppWebhookAck:
    """Endpoint oficial para recibir eventos de WhatsApp Cloud API."""
    if not _legacy_processing_enabled():
        logger.warning("deprecated_whatsapp_webhook_receive_blocked")
        raise HTTPException(status_code=410, detail="deprecated_whatsapp_webhook_disabled")

    clinic_id = request.headers.get("X-Clinic-Id", "").strip() or "default"

    body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")

    try:
        payload: dict[str, Any] = await request.json()
    except Exception as exc:
        logger.exception("webhook_invalid_json", extra={"clinic_id": clinic_id, "error": str(exc)})
        raise HTTPException(status_code=400, detail="invalid_json") from exc

    webhook_service = WhatsAppWebhookService(signing_secret=WHATSAPP_APP_SECRET or WHATSAPP_ACCESS_TOKEN)
    parsed = webhook_service.parse_first_message(payload)
    if not parsed:
        return WhatsAppWebhookAck(
            status="ignored",
            clinic_id=clinic_id,
            received_at=datetime.utcnow().isoformat(),
        )

    account: ClientWhatsAppAccount | None = None
    access_token: str | None = None
    app_secret = WHATSAPP_APP_SECRET
    if parsed.phone_number_id:
        account = (
            await db.execute(
                select(ClientWhatsAppAccount).where(
                    ClientWhatsAppAccount.phone_number_id == parsed.phone_number_id,
                    ClientWhatsAppAccount.status.in_(("active", "connected")),
                    ClientWhatsAppAccount.webhook_enabled.is_(True),
                )
            )
        ).scalars().first()
        if account is not None:
            clinic_id = str(account.clinic_id or clinic_id)
            try:
                access_token = decrypt_secret(account.access_token_encrypted) if account.access_token_encrypted else None
                app_secret = decrypt_secret(account.app_secret_encrypted) if account.app_secret_encrypted else app_secret
            except SecretEncryptionError as exc:
                logger.error("whatsapp_token_decrypt_failed", extra={"clinic_id": clinic_id, "error": str(exc)})
                raise HTTPException(status_code=503, detail="token_decrypt_failed") from exc

    if parsed.phone_number_id and account is None:
        logger.warning("whatsapp_account_not_found", extra={"phone_number_id": parsed.phone_number_id})
        raise HTTPException(status_code=404, detail="whatsapp_account_not_found")

    if app_secret and not WhatsAppWebhookService(signing_secret=app_secret).verify_signature(body, signature):
        logger.warning(
            "webhook_signature_invalid",
            extra={"clinic_id": clinic_id, "phone_number_id": parsed.phone_number_id},
        )
        raise HTTPException(status_code=403, detail="invalid_signature")

    shadow_service = ShadowProfileService(db)
    patient = await shadow_service.get_or_create_by_phone(
        phone=parsed.phone,
        client_id=account.client_id if account is not None else None,
        clinic_id=account.clinic_id if account is not None else None,
    )

    intent = webhook_service.detect_intent(parsed.text)

    contract_payload = {
        "request_id": parsed.message_id or str(uuid4()),
        "tenant_id": clinic_id,
        "actor_id": parsed.phone,
        "actor_role": "patient",
        "assistant_mode": "appointment_booking",
        "channel": "whatsapp",
        "message": parsed.text,
        "allowed_tools": [],
        "forbidden_tools": default_forbidden_tools_for_mode("appointment_booking"),
    }
    try:
        validated_mode = validate_runtime_brain_request(contract_payload)
    except ContractValidationError as exc:
        logger.warning(
            "Contract validation blocked WhatsApp webhook request_id=%s reason=%s",
            contract_payload["request_id"],
            str(exc),
        )
        raise HTTPException(status_code=422, detail="contract_validation_blocked") from exc

    requested_tool = _tool_for_whatsapp_intent(intent)
    if requested_tool:
        guard: ModeGuardResult = evaluate_mode_guard(validated_mode, requested_tool)
        if not guard.allowed:
            logger.warning(
                "Mode guard blocked WhatsApp webhook request_id=%s tool=%s reason=%s",
                contract_payload["request_id"],
                requested_tool,
                guard.reason,
            )
            raise HTTPException(status_code=403, detail="mode_guard_blocked")

    patient_name = getattr(patient, "name", None) or "paciente"
    auto_reply = webhook_service.build_auto_reply(intent, patient_name)

    # Enviar respuesta al usuario via WhatsApp Cloud API
    await _send_whatsapp_reply(
        parsed.phone,
        auto_reply,
        phone_number_id=parsed.phone_number_id,
        access_token=access_token,
    )

    logger.info(
        "whatsapp_webhook_processed",
        extra={
            "clinic_id": clinic_id,
            "client_id": str(account.client_id) if account is not None else None,
            "phone_number_id": parsed.phone_number_id,
            "phone": parsed.phone,
            "intent": intent,
            "patient_id": str(getattr(patient, "id", "")),
        },
    )

    await broadcast_realtime_event(
        "message",
        {
            "clinic_id": clinic_id,
            "patient_id": str(getattr(patient, "id", "")),
            "phone": parsed.phone,
            "text": parsed.text,
            "intent": intent,
            "auto_reply": auto_reply,
            "received_at": datetime.utcnow().isoformat(),
        },
    )

    return WhatsAppWebhookAck(
        status="processed",
        intent=intent,
        clinic_id=clinic_id,
        patient_id=str(getattr(patient, "id", "")),
        auto_reply=auto_reply,
        received_at=datetime.utcnow().isoformat(),
    )
