from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from api.app.dependencies.db import get_db
from api.app.eventing.realtime_notifications import broadcast_realtime_event
from api.app.services.shadow_profile_service import ShadowProfileService
from api.app.services.whatsapp_webhook_service import WhatsAppWebhookService
import httpx
from shared.config import WHATSAPP_ACCESS_TOKEN, WHATSAPP_APP_SECRET, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN
from shared.utils import setup_logger

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
logger = setup_logger(__name__)


async def _send_whatsapp_reply(to_phone: str, message: str) -> None:
    """Envía un mensaje de texto via WhatsApp Cloud API."""
    if not WHATSAPP_PHONE_NUMBER_ID or not WHATSAPP_ACCESS_TOKEN:
        logger.warning("whatsapp_send_skipped_missing_credentials")
        return
    url = f"https://graph.facebook.com/v19.0/{WHATSAPP_PHONE_NUMBER_ID}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": to_phone,
        "type": "text",
        "text": {"body": message},
    }
    headers = {"Authorization": f"Bearer {WHATSAPP_ACCESS_TOKEN}"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code != 200:
                logger.warning("whatsapp_send_failed", extra={"status": resp.status_code, "body": resp.text})
            else:
                logger.info("whatsapp_reply_sent", extra={"to": to_phone})
    except Exception as exc:
        logger.exception("whatsapp_send_error", extra={"error": str(exc)})


class WhatsAppWebhookAck(BaseModel):
    status: str
    intent: str | None = None
    clinic_id: str
    patient_id: str | None = None
    auto_reply: str | None = None
    received_at: str


@router.get("/whatsapp")
async def verify_whatsapp_webhook(
    hub_mode: str | None = Query(default=None, alias="hub.mode"),
    hub_verify_token: str | None = Query(default=None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(default=None, alias="hub.challenge"),
) -> PlainTextResponse:
    """Handshake de verificacion requerido por Meta al registrar el webhook."""
    if hub_mode != "subscribe":
        raise HTTPException(status_code=403, detail="invalid_mode")

    if not WHATSAPP_VERIFY_TOKEN or hub_verify_token != WHATSAPP_VERIFY_TOKEN:
        logger.warning("webhook_verify_token_invalid")
        raise HTTPException(status_code=403, detail="invalid_verify_token")

    if not hub_challenge:
        raise HTTPException(status_code=400, detail="missing_challenge")

    logger.info("whatsapp_webhook_verified")
    return PlainTextResponse(content=hub_challenge, status_code=200)


@router.post("/whatsapp", response_model=WhatsAppWebhookAck)
async def receive_whatsapp_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> WhatsAppWebhookAck:
    """Endpoint oficial para recibir eventos de WhatsApp Cloud API."""
    clinic_id = request.headers.get("X-Clinic-Id", "").strip() or "default"

    body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")

    webhook_service = WhatsAppWebhookService(signing_secret=WHATSAPP_APP_SECRET or WHATSAPP_ACCESS_TOKEN)
    if WHATSAPP_APP_SECRET and not webhook_service.verify_signature(body, signature):
        logger.warning("webhook_signature_invalid", extra={"clinic_id": clinic_id})
        raise HTTPException(status_code=403, detail="invalid_signature")

    try:
        payload: dict[str, Any] = await request.json()
    except Exception as exc:
        logger.exception("webhook_invalid_json", extra={"clinic_id": clinic_id, "error": str(exc)})
        raise HTTPException(status_code=400, detail="invalid_json") from exc

    parsed = webhook_service.parse_first_message(payload)
    if not parsed:
        return WhatsAppWebhookAck(
            status="ignored",
            clinic_id=clinic_id,
            received_at=datetime.utcnow().isoformat(),
        )

    shadow_service = ShadowProfileService(db)
    patient = await shadow_service.get_or_create_by_phone(phone=parsed.phone)

    intent = webhook_service.detect_intent(parsed.text)
    patient_name = getattr(patient, "name", None) or "paciente"
    auto_reply = webhook_service.build_auto_reply(intent, patient_name)

    # Enviar respuesta al usuario via WhatsApp Cloud API
    await _send_whatsapp_reply(parsed.phone, auto_reply)

    logger.info(
        "whatsapp_webhook_processed",
        extra={
            "clinic_id": clinic_id,
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
