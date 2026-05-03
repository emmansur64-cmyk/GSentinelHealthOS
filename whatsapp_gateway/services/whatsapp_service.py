"""
Servicio de WhatsApp Gateway
Transporte ligero que recibe mensajes de Meta y los encola
"""

import json
import hmac
import hashlib
from typing import Optional, Dict, Any
import httpx

from shared.config import REDIS_URL
from shared.utils import setup_logger
from shared.utils.resilience import CircuitBreakerConfig, CircuitBreakerRegistry, retry_async

logger = setup_logger(__name__)


_WHATSAPP_META_BREAKER = CircuitBreakerRegistry.get(
    "provider.whatsapp.meta",
    CircuitBreakerConfig(failure_threshold=4, reset_timeout_seconds=30.0, half_open_max_calls=1),
)


class WhatsAppService:
    """Servicio de WhatsApp - Recibe y envía mensajes"""
    
    def __init__(
        self,
        phone_number_id: str,
        business_account_id: str,
        access_token: str,
        app_secret: str,
        verify_token: str
    ):
        """
        Args:
            phone_number_id: ID del número de teléfono de WhatsApp
            business_account_id: ID de la cuenta de negocio
            access_token: Token de acceso de Meta
            app_secret: App Secret de Meta (usado para verificar firma webhook)
            verify_token: Token para verificar webhooks
        """
        self.phone_number_id = phone_number_id
        self.business_account_id = business_account_id
        self.access_token = access_token
        self.app_secret = app_secret
        self.verify_token = verify_token
    
    def verify_webhook(self, verify_token: str, challenge: str) -> Optional[str]:
        """Verifica desafío de webhook de Meta"""
        if verify_token == self.verify_token:
            logger.info("Webhook verificado correctamente")
            return challenge
        logger.warning("Token de verificacion invalido")
        return None
    
    def verify_signature(
        self,
        request_body: bytes,
        signature: str,
        *,
        app_secret: str | None = None,
    ) -> bool:
        """Verifica firma HMAC del request de Meta"""
        signing_secret = (app_secret or self.app_secret or "").strip()
        if not signing_secret:
            logger.warning("WHATSAPP_APP_SECRET no configurado; no se puede validar firma Meta")
            return False

        received_signature = signature.removeprefix("sha256=").strip()
        expected_signature = hmac.new(
            signing_secret.encode(),
            request_body,
            hashlib.sha256
        ).hexdigest()
        
        is_valid = hmac.compare_digest(received_signature, expected_signature)
        if is_valid:
            logger.info("firma webhook válida")
        else:
            logger.warning("Firma de request invalida")
        return is_valid
    
    def parse_incoming_message(self, webhook_data: Dict[str, Any]) -> Optional[Dict]:
        """
        Parsea mensaje entrante de Meta
        
        Args:
            webhook_data: Datos del webhook
            
        Returns:
            Dict con mensaje parseado o None
        """
        try:
            # Estructura típica de Meta
            entries = webhook_data.get("entry", [])
            
            for entry in entries:
                changes = entry.get("changes", [])
                
                for change in changes:
                    value = change.get("value", {})
                    metadata = value.get("metadata", {})
                    phone_number_id = metadata.get("phone_number_id")
                    messages = value.get("messages", [])
                    
                    for message in messages:
                        return {
                            "from": message.get("from"),
                            "id": message.get("id"),
                            "timestamp": message.get("timestamp"),
                            "type": message.get("type"),
                            "text": message.get("text", {}).get("body", ""),
                            "phone_number_id": phone_number_id,
                            "raw_data": message
                        }
            
            return None
        except Exception as e:
            logger.error(f"Error parseando mensaje: {str(e)}")
            return None
    
    async def send_message(
        self,
        phone_number: str,
        message_text: str,
        *,
        access_token: str | None = None,
        phone_number_id: str | None = None,
    ) -> bool:
        """
        Envía mensaje de WhatsApp (viejo, ahora usa encolado)
        
        Args:
            phone_number: Número del destinatario
            message_text: Texto del mensaje
            
        Returns:
            True si se envió correctamente
        """
        logger.info(f"Enviando mensaje a {phone_number}")

        resolved_phone_number_id = (phone_number_id or self.phone_number_id or "").strip()
        resolved_access_token = (access_token or self.access_token or "").strip()

        if not resolved_phone_number_id or not resolved_access_token:
            logger.warning("Configuracion incompleta de WhatsApp Meta API")
            return False

        url = f"https://graph.facebook.com/v21.0/{resolved_phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {resolved_access_token}",
            "Content-Type": "application/json",
        }
        payload = {
            "messaging_product": "whatsapp",
            "to": phone_number,
            "type": "text",
            "text": {"body": message_text},
        }

        def _retryable(exc: BaseException) -> bool:
            if isinstance(exc, httpx.TimeoutException):
                return True
            if isinstance(exc, httpx.ConnectError):
                return True
            if isinstance(exc, httpx.HTTPStatusError):
                return exc.response.status_code >= 500 or exc.response.status_code == 429
            return False

        async def _send_once() -> None:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()

        async def _send_with_retry() -> None:
            await retry_async(
                _send_once,
                retries=2,
                base_delay_seconds=0.5,
                max_delay_seconds=4.0,
                jitter_seconds=0.2,
                retry_predicate=_retryable,
            )

        try:
            await _WHATSAPP_META_BREAKER.call(_send_with_retry)
            logger.info(f"Mensaje enviado a {phone_number}")
            return True
        except Exception as exc:
            logger.warning(f"Error enviando mensaje a {phone_number}: {exc}")
            return False


class MessageQueueService:
    """Servicio de cola - Encola mensajes para procesamiento"""
    
    def __init__(self, redis_url: str = REDIS_URL):
        """
        Args:
            redis_url: URL de conexión a Redis
        """
        self.redis_url = redis_url
        # self.redis = redis.from_url(redis_url)
    
    async def enqueue_message(
        self,
        message: Dict,
        queue_name: str = "whatsapp:incoming"
    ) -> bool:
        """
        Encola un mensaje para procesamiento
        
        Args:
            message: Mensaje a encolar
            queue_name: Nombre de la cola
            
        Returns:
            True si se encoló correctamente
        """
        try:
            logger.info(f"Encolando mensaje de {message.get('from')}")
            
            # Aquí iría:
            # await self.redis.lpush(queue_name, json.dumps(message))
            
            logger.info(f"Mensaje encolado en {queue_name}")
            return True
        except Exception as e:
            logger.error(f"Error encolando mensaje: {str(e)}")
            return False
