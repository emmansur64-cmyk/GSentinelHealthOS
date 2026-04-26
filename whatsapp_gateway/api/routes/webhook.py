"""
Webhook routes para recibir mensajes de Meta WhatsApp
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request

from shared.config import (
    WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_APP_SECRET,
    WHATSAPP_BUSINESS_ACCOUNT_ID,
    WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_VERIFY_TOKEN,
)
from shared.utils import setup_logger
from whatsapp_gateway.app.queue import WhatsAppQueueProducer
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


@router.get("/whatsapp")
async def verify_webhook(
    hub_mode: Optional[str] = Query(default=None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(default=None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(default=None, alias="hub.challenge"),
) -> str:
    """
    GET endpoint para verificar webhook de Meta
    Meta envía esto en el setup inicial
    """
    logger.info("Recibido desafío de verificación de webhook")
    
    if hub_mode != "subscribe":
        logger.warning(f"hub_mode inválido: {hub_mode}")
        raise HTTPException(status_code=403, detail="hub.mode is not subscribe")
    
    challenge = whatsapp_service.verify_webhook(hub_verify_token or "", hub_challenge or "")
    if not challenge:
        raise HTTPException(status_code=403, detail="verify token mismatch")
    
    return challenge


@router.post("/whatsapp")
async def receive_webhook(request: Request):
    """
    POST endpoint para recibir mensajes de WhatsApp de Meta
    Valida firma, parsea mensaje y encola para procesamiento
    """
    # Obtener body y firma
    body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")
    
    # Validar firma HMAC
    if not whatsapp_service.verify_signature(body, signature):
        logger.error("Firma inválida en webhook")
        raise HTTPException(status_code=403, detail="Invalid signature")
    
    # Parsear JSON
    try:
        webhook_data = await request.json()
    except Exception as e:
        logger.error(f"Error parseando JSON: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    # Extraer mensaje
    message = whatsapp_service.parse_incoming_message(webhook_data)
    
    if message:
        logger.info(f"Mensaje recibido de {message.get('from')}")
        
        # Encolar para procesamiento asíncrono
        was_enqueued = await queue_service.publish(message)
        if not was_enqueued:
            logger.info("Mensaje duplicado ignorado por idempotencia id=%s", message.get("id"))
            return {"status": "duplicate_ignored"}
        
        return {"status": "received"}
    
    logger.debug("No hay mensajes en el webhook")
    return {"status": "ok"}
