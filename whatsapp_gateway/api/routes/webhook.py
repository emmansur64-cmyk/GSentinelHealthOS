"""
Webhook routes para recibir mensajes de Meta WhatsApp
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse

from shared.config import (
    WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_APP_SECRET,
    WHATSAPP_BUSINESS_ACCOUNT_ID,
    WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_VERIFY_TOKEN,
)
from shared.utils import setup_logger
from whatsapp_gateway.app.queue import WhatsAppQueueProducer
from whatsapp_gateway.services.account_resolver import ClientWhatsAppAccountResolver
from whatsapp_gateway.services.whatsapp_service import WhatsAppService

logger = setup_logger(__name__)
router = APIRouter(prefix="/webhook", tags=["webhook"])

# Instancias de servicios (en prod, inyectar desde DI)
whatsapp_service = WhatsAppService(
    phone_number_id=WHATSAPP_PHONE_NUMBER_ID,
    business_account_id=WHATSAPP_BUSINESS_ACCOUNT_ID,
    access_token=WHATSAPP_ACCESS_TOKEN,
    app_secret=WHATSAPP_APP_SECRET,
    verify_token=WHATSAPP_VERIFY_TOKEN,
)
queue_service = WhatsAppQueueProducer()
account_resolver = ClientWhatsAppAccountResolver()


def _extract_phone_number_id(payload: dict[str, Any]) -> str | None:
    entries = payload.get("entry", [])
    for entry in entries:
        for change in entry.get("changes", []):
            value = change.get("value", {})
            metadata = value.get("metadata", {})
            phone_number_id = metadata.get("phone_number_id")
            if phone_number_id:
                return str(phone_number_id)
    return None


async def shutdown_resources() -> None:
    await queue_service.close()
    await account_resolver.close()


@router.get("/whatsapp")
async def verify_webhook(
    hub_mode: Optional[str] = Query(default=None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(default=None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(default=None, alias="hub.challenge"),
) -> PlainTextResponse:
    """
    GET endpoint para verificar webhook de Meta
    Meta envía esto en el setup inicial
    """
    logger.info("Recibido desafío de verificación de webhook")
    
    if hub_mode != "subscribe":
        logger.warning(f"hub_mode inválido: {hub_mode}")
        raise HTTPException(status_code=403, detail="hub.mode is not subscribe")
    
    token = (hub_verify_token or "").strip()
    if token and token == WHATSAPP_VERIFY_TOKEN:
        return PlainTextResponse(content=str(hub_challenge), status_code=200)

    account = await account_resolver.get_by_verify_token(token)
    if account is None:
        raise HTTPException(status_code=403, detail="verify token mismatch")
    
    return PlainTextResponse(content=str(hub_challenge), status_code=200)


@router.post("/whatsapp")
async def receive_webhook(request: Request):
    """
    POST endpoint para recibir mensajes de WhatsApp de Meta
    Valida firma, parsea mensaje y encola para procesamiento
    """
    # Obtener body y firma
    body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")

    if not (WHATSAPP_APP_SECRET or "").strip():
        logger.critical("whatsapp_app_secret_missing_in_production")
        raise HTTPException(status_code=503, detail="signing_secret_missing")

    # Meta exige validacion sobre body raw exacto.
    if not whatsapp_service.verify_signature(body, signature, app_secret=WHATSAPP_APP_SECRET):
        logger.error("Firma invalida en webhook")
        raise HTTPException(status_code=403, detail="Invalid signature")

    # Parsear JSON despues de validar firma.
    try:
        webhook_data = await request.json()
    except Exception as e:
        logger.error(f"Error parseando JSON: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid JSON")

    if "entry" not in webhook_data:
        return {"status": "ignored"}

    logger.info("Incoming webhook recibido correctamente")

    incoming_phone_number_id = _extract_phone_number_id(webhook_data)
    if not incoming_phone_number_id:
        logger.warning("webhook_missing_phone_number_id")
        raise HTTPException(status_code=422, detail="phone_number_id_missing")

    account = await account_resolver.get_by_phone_number_id(incoming_phone_number_id)
    if account is None:
        if incoming_phone_number_id != WHATSAPP_PHONE_NUMBER_ID:
            logger.critical(
                "ERROR CRITICO: Phone Number ID incorrecto",
                extra={"phone_number_id": incoming_phone_number_id},
            )
            return {"status": "ignored"}

        account = SimpleNamespace(
            client_id="default",
            clinic_id=None,
            phone_number_id=WHATSAPP_PHONE_NUMBER_ID,
            access_token=WHATSAPP_ACCESS_TOKEN,
            app_secret=WHATSAPP_APP_SECRET,
        )

    # Extraer mensaje
    message = whatsapp_service.parse_incoming_message(webhook_data)
    
    if message:
        logger.info(f"Mensaje recibido de {message.get('from')}")

        queue_payload = {
            "id": message.get("id"),
            # tenant_id explicito para consumidores nuevos; client_id se mantiene por compatibilidad.
            "tenant_id": account.client_id,
            "client_id": account.client_id,
            "clinic_id": account.clinic_id,
            "phone_number_id": account.phone_number_id,
            "from": message.get("from"),
            "text": message.get("text"),
            "timestamp": message.get("timestamp"),
            "type": message.get("type"),
            "raw": webhook_data,
        }
        if queue_payload["clinic_id"] is None:
            logger.warning(
                "whatsapp_routing_tenant_only",
                extra={"tenant_id": queue_payload["tenant_id"], "phone_number_id": queue_payload["phone_number_id"]},
            )
        logger.info(
            "Mensaje WhatsApp resuelto",
            extra={
                "tenant_id": queue_payload["tenant_id"],
                "client_id": queue_payload["client_id"],
                "clinic_id": queue_payload.get("clinic_id"),
                "phone_number_id": queue_payload.get("phone_number_id"),
            },
        )
        
        # Encolar para procesamiento asíncrono
        was_enqueued = await queue_service.publish(queue_payload)
        if not was_enqueued:
            logger.info("Mensaje duplicado ignorado por idempotencia id=%s", queue_payload.get("id"))
            return {"status": "duplicate_ignored"}
        
        return {"status": "received"}
    
    logger.debug("No hay mensajes en el webhook")
    return {"status": "ok"}
