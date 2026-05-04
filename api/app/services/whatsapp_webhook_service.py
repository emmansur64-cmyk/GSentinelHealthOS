from __future__ import annotations

from dataclasses import dataclass
import hashlib
import hmac
from typing import Any, Optional


@dataclass
class ParsedWhatsAppMessage:
    phone: str
    text: str
    message_id: str
    phone_number_id: str | None
    raw_data: dict[str, Any]


class WhatsAppWebhookService:
    """Utilidades de seguridad y parseo para webhook oficial de Meta."""

    def __init__(self, signing_secret: str):
        self.signing_secret = signing_secret or ""

    def verify_signature(self, body: bytes, signature_header: str) -> bool:
        """Verifica X-Hub-Signature-256 de Meta con HMAC SHA256."""
        if not self.signing_secret:
            return False
        if not signature_header:
            return False

        expected = hmac.new(
            self.signing_secret.encode("utf-8"),
            body,
            hashlib.sha256,
        ).hexdigest()

        incoming = signature_header.strip()
        if incoming.startswith("sha256="):
            incoming = incoming[len("sha256="):]

        return hmac.compare_digest(expected, incoming)

    def parse_first_message(self, payload: dict[str, Any]) -> Optional[ParsedWhatsAppMessage]:
        """Extrae el primer mensaje de texto del payload oficial Meta."""
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                metadata = value.get("metadata", {})
                phone_number_id = str(metadata.get("phone_number_id") or "").strip() or None
                for message in value.get("messages", []):
                    phone = str(message.get("from") or "").strip()
                    text = str((message.get("text") or {}).get("body") or "").strip()
                    message_id = str(message.get("id") or "")
                    if phone:
                        return ParsedWhatsAppMessage(
                            phone=phone,
                            text=text,
                            message_id=message_id,
                            phone_number_id=phone_number_id,
                            raw_data=message,
                        )
        return None

    def detect_intent(self, text: str) -> str:
        normalized = (text or "").lower()
        if any(word in normalized for word in ["turno", "cita", "agendar", "reservar"]):
            return "book_appointment"
        if any(word in normalized for word in ["reprogram", "mover", "cambiar hora"]):
            return "reschedule_appointment"
        if any(word in normalized for word in ["cancel", "anular"]):
            return "cancel_appointment"
        return "general_query"

    def build_auto_reply(self, intent: str, patient_name: str) -> str:
        if intent == "book_appointment":
            return (
                f"Hola {patient_name}, ya recibi tu solicitud de turno. "
                "Indica especialidad y franja horaria para asignarte el primer hueco disponible."
            )
        if intent == "reschedule_appointment":
            return (
                f"Hola {patient_name}, vamos a reprogramar tu turno. "
                "Comparte tu disponibilidad y te envio opciones."
            )
        if intent == "cancel_appointment":
            return (
                f"Hola {patient_name}, recibimos tu solicitud de cancelacion. "
                "En breve confirmamos el estado actualizado de tu turno."
            )
        return (
            f"Hola {patient_name}, gracias por escribir. "
            "Puedo ayudarte con turnos, reprogramaciones y cancelaciones."
        )
