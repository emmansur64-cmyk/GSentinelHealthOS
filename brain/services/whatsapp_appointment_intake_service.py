from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from brain.core.state_manager import StateManager
from brain.integration.api_client import APIClient, APIClientError
from brain.services.appointment_scheduler_service import AppointmentSchedulerService, ScheduledSlot
from shared.utils import setup_logger

logger = setup_logger(__name__)

_REQUIRED_STATES = {
    "ASK_FULL_NAME",
    "ASK_DNI",
    "ASK_PHONE",
    "ASK_EMAIL",
    "ASK_AGE",
    "ASK_SPECIALTY",
    "ASK_SOCIAL_SECURITY",
    "SEARCH_AVAILABILITY",
    "CONFIRM_APPOINTMENT",
    "COMPLETED",
}

_CONFIRM_WORDS = {"si", "sí", "dale", "confirmo", "ok", "esta bien", "está bien"}
_REJECT_WORDS = {"no", "otro horario", "no puedo", "mas tarde", "más tarde"}

_SOCIAL_SECURITY_ALIASES = {
    "OSDE": ("osde",),
    "PAMI": ("pami",),
    "IOMA": ("ioma",),
    "Swiss Medical": ("swiss", "swiss medical"),
    "Galeno": ("galeno",),
    "Medicus": ("medicus",),
    "APROSS": ("apross",),
    "Particular": ("particular", "sin obra social", "no tengo", "ninguna"),
}

_SPECIALTY_ALIASES = {
    "Cardiologia": ("cardio", "cardiologia", "corazon", "corazón"),
    "Traumatologia": ("trauma", "traumatologia", "traumatología"),
    "Pediatria": ("pediatria", "pediatra"),
    "Dermatologia": ("dermato", "dermatologia", "dermatología"),
    "Neurologia": ("neuro", "neurologia", "neurología"),
    "Medicina General": ("medicina general", "medico general", "médico general", "general"),
}

_URGENT_PATTERNS = (
    "dolor de pecho",
    "falta de aire",
    "perdida de conocimiento",
    "pérdida de conocimiento",
    "sangrado intenso",
    "acv",
    "convulsiones",
)


@dataclass
class IntakeResult:
    text: str
    done: bool = False
    metadata: dict[str, Any] | None = None


class WhatsAppAppointmentIntakeService:
    """Flujo estricto por estados para capturar datos y crear turnos por WhatsApp."""

    def __init__(
        self,
        *,
        state_manager: StateManager,
        api_client: APIClient,
        scheduler: AppointmentSchedulerService,
    ) -> None:
        self.state_manager = state_manager
        self.api_client = api_client
        self.scheduler = scheduler

    @staticmethod
    def _normalize_text(text: str) -> str:
        return (text or "").strip().lower()

    @staticmethod
    def _extract_phone(raw_phone: str) -> str:
        digits = re.sub(r"[^\d+]", "", raw_phone or "")
        if digits.startswith("00"):
            return f"+{digits[2:]}"
        if not digits.startswith("+"):
            return f"+{re.sub(r'\D', '', digits)}"
        return digits

    @staticmethod
    def _is_valid_name(value: str) -> bool:
        parts = [part for part in value.strip().split() if part]
        return len(parts) >= 2

    @staticmethod
    def _is_valid_dni(value: str) -> bool:
        return bool(re.fullmatch(r"\d{7,9}", value or ""))

    @staticmethod
    def _is_valid_email(value: str) -> bool:
        if not value:
            return False
        return bool(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value.strip()))

    @staticmethod
    def _parse_age(value: str) -> int | None:
        try:
            age = int(value.strip())
        except Exception:
            return None
        if age < 0 or age > 120:
            return None
        return age

    @classmethod
    def _normalize_specialty(cls, value: str) -> str | None:
        normalized = cls._normalize_text(value)
        for canonical, aliases in _SPECIALTY_ALIASES.items():
            if any(alias in normalized for alias in aliases):
                return canonical
        return None

    @staticmethod
    def _is_urgent(text: str) -> bool:
        normalized = (text or "").lower()
        return any(pattern in normalized for pattern in _URGENT_PATTERNS)

    @staticmethod
    def _normalize_social_security(value: str) -> str:
        normalized = (value or "").strip().lower()
        for canonical, aliases in _SOCIAL_SECURITY_ALIASES.items():
            if any(alias in normalized for alias in aliases):
                return canonical
        # Cualquier texto no vacío se acepta tal cual con capitalización de título
        return value.strip().title() if value.strip() else "Particular"

    @staticmethod
    def _next_missing_state(data: dict[str, Any]) -> str:
        if not data.get("patient_full_name"):
            return "ASK_FULL_NAME"
        if not data.get("patient_dni"):
            return "ASK_DNI"
        if not data.get("patient_phone"):
            return "ASK_PHONE"
        if not data.get("patient_email"):
            return "ASK_EMAIL"
        if data.get("patient_age") is None:
            return "ASK_AGE"
        if not data.get("specialty"):
            return "ASK_SPECIALTY"
        if not data.get("social_security"):
            return "ASK_SOCIAL_SECURITY"
        return "SEARCH_AVAILABILITY"

    @staticmethod
    def _prompt_for_state(state: str) -> str:
        prompts = {
            "ASK_FULL_NAME": "Hola, soy el asistente de turnos. Para comenzar necesito tu Apellido y Nombre.",
            "ASK_DNI": "Perfecto. Ahora necesito tu DNI para registrar el turno.",
            "ASK_PHONE": "Gracias. Indícame tu teléfono (con característica o formato internacional).",
            "ASK_EMAIL": "Ahora necesito tu email.",
            "ASK_AGE": "Bien. ¿Qué edad tenés?",
            "ASK_SPECIALTY": "¿Qué especialidad necesitás? Por ejemplo: Cardiología o Traumatología.",
            "ASK_SOCIAL_SECURITY": "Perfecto. ¿Qué obra social tenés? Si sos particular, escribí \"Particular\".",
        }
        return prompts.get(state, "Necesito un dato más para continuar.")

    def _seed_state(self, phone: str, clinic_id: str, initial_text: str) -> dict[str, Any]:
        return {
            "step": "ASK_FULL_NAME",
            "context": {
                "clinic_id": clinic_id,
                "patient_phone": phone,
                "last_user_text": initial_text,
                "conversation_started_at": datetime.utcnow().isoformat(),
            },
        }

    def _capture_opportunistic_fields(self, text: str, context: dict[str, Any]) -> None:
        raw = text.strip()
        if not raw:
            return

        if not context.get("patient_dni"):
            maybe_dni = re.search(r"\b(\d{7,9})\b", raw)
            if maybe_dni:
                context["patient_dni"] = maybe_dni.group(1)

        if not context.get("patient_email"):
            maybe_email = re.search(r"([^@\s]+@[^@\s]+\.[^@\s]+)", raw)
            if maybe_email and self._is_valid_email(maybe_email.group(1)):
                context["patient_email"] = maybe_email.group(1).lower()

        if context.get("patient_age") is None:
            maybe_age = re.search(r"\b(\d{1,3})\b", raw)
            if maybe_age:
                parsed_age = self._parse_age(maybe_age.group(1))
                if parsed_age is not None:
                    context["patient_age"] = parsed_age

        if not context.get("specialty"):
            detected_specialty = self._normalize_specialty(raw)
            if detected_specialty:
                context["specialty"] = detected_specialty

    async def process(
        self,
        *,
        phone: str,
        text: str,
        clinic_id: str | None,
        client_id: str | None,
        phone_number_id: str | None,
        current_state: dict[str, Any],
        inferred_intent: str,
    ) -> IntakeResult | None:
        if not clinic_id:
            return None

        normalized_text = self._normalize_text(text)
        step = str(current_state.get("step") or "idle")
        in_flow = step in _REQUIRED_STATES
        start_by_intent = inferred_intent in {"book_appointment", "check_availability"}

        if not in_flow and not start_by_intent:
            return None

        if self._is_urgent(text):
            warning = (
                "Por los síntomas que mencionás, te recomiendo acudir a una guardia o llamar a emergencias. "
                "También puedo ayudarte a solicitar un turno, pero esto no reemplaza atención urgente."
            )
            await self.state_manager.set_state(
                phone,
                {
                    "step": "ASK_SPECIALTY" if in_flow else "ASK_FULL_NAME",
                    "context": dict(current_state.get("context") or {}),
                },
                clinic_id=clinic_id,
            )
            return IntakeResult(text=warning)

        if not in_flow:
            seeded = self._seed_state(phone=phone, clinic_id=clinic_id, initial_text=text)
            await self.state_manager.set_state(phone, seeded, clinic_id=clinic_id)
            return IntakeResult(text=self._prompt_for_state("ASK_FULL_NAME"))

        context = dict(current_state.get("context") or {})
        context.setdefault("clinic_id", clinic_id)
        context.setdefault("patient_phone", self._extract_phone(phone))
        self._capture_opportunistic_fields(text, context)

        if step == "ASK_FULL_NAME":
            if not self._is_valid_name(text):
                return IntakeResult(text="Necesito Apellido y Nombre (al menos 2 palabras).")
            context["patient_full_name"] = text.strip()
            step = "ASK_DNI"

        elif step == "ASK_DNI":
            if not self._is_valid_dni(re.sub(r"\D", "", text)):
                return IntakeResult(text="El DNI debe tener solo números (7 a 9 dígitos).")
            context["patient_dni"] = re.sub(r"\D", "", text)
            step = "ASK_PHONE"

        elif step == "ASK_PHONE":
            normalized_phone = self._extract_phone(text)
            if len(re.sub(r"\D", "", normalized_phone)) < 8:
                return IntakeResult(text="El teléfono parece inválido. Enviámelo con característica.")
            context["patient_phone"] = normalized_phone
            step = "ASK_EMAIL"

        elif step == "ASK_EMAIL":
            if not self._is_valid_email(text):
                return IntakeResult(text="El email no tiene formato válido. Inténtalo nuevamente.")
            context["patient_email"] = text.strip().lower()
            step = "ASK_AGE"

        elif step == "ASK_AGE":
            age = self._parse_age(text)
            if age is None:
                return IntakeResult(text="La edad debe ser un número entre 0 y 120.")
            context["patient_age"] = age
            step = "ASK_SPECIALTY"

        elif step == "ASK_SPECIALTY":
            specialty = self._normalize_specialty(text)
            if specialty is None:
                return IntakeResult(text="No reconocí esa especialidad. Probá con Cardiología, Traumatología, Pediatría, etc.")
            context["specialty"] = specialty
            step = "ASK_SOCIAL_SECURITY"

        elif step == "ASK_SOCIAL_SECURITY":
            if not text.strip():
                return IntakeResult(text='¿Qué obra social tenés? Si sos particular, escribí "Particular".')
            context["social_security"] = self._normalize_social_security(text)
            step = "SEARCH_AVAILABILITY"

        elif step == "CONFIRM_APPOINTMENT":
            if normalized_text in _REJECT_WORDS:
                lock_key = context.get("slot_lock_key")
                if lock_key:
                    await self.scheduler.release_slot_lock(str(lock_key))
                context.pop("slot_lock_key", None)
                context.pop("candidate_slot", None)
                step = "SEARCH_AVAILABILITY"
            elif normalized_text in _CONFIRM_WORDS:
                return await self._confirm_appointment(
                    phone=phone,
                    clinic_id=clinic_id,
                    client_id=client_id,
                    phone_number_id=phone_number_id,
                    context=context,
                )
            else:
                return IntakeResult(text="Respondé 'sí' para confirmar o 'no' para buscar otro horario.")

        if step == "SEARCH_AVAILABILITY":
            return await self._search_and_offer_slot(
                phone=phone,
                clinic_id=clinic_id,
                client_id=client_id,
                context=context,
            )

        next_required = self._next_missing_state(context)
        await self.state_manager.set_state(
            phone,
            {"step": next_required, "context": context},
            clinic_id=clinic_id,
        )
        return IntakeResult(text=self._prompt_for_state(next_required))

    async def _search_and_offer_slot(
        self,
        *,
        phone: str,
        clinic_id: str,
        client_id: str | None,
        context: dict[str, Any],
    ) -> IntakeResult:
        specialty = str(context.get("specialty") or "").strip()
        if not specialty:
            await self.state_manager.set_state(
                phone,
                {"step": "ASK_SPECIALTY", "context": context},
                clinic_id=clinic_id,
            )
            return IntakeResult(text=self._prompt_for_state("ASK_SPECIALTY"))

        slot = await self.scheduler.find_next_available_slot(
            clinic_id=clinic_id,
            specialty=specialty,
            client_id=client_id,
        )
        if slot is None:
            await self.state_manager.set_state(
                phone,
                {"step": "ASK_SPECIALTY", "context": context},
                clinic_id=clinic_id,
            )
            return IntakeResult(text=f"No encontré disponibilidad para {specialty}. ¿Probamos otra especialidad?")

        context["slot_lock_key"] = slot.lock_key
        context["candidate_slot"] = {
            "doctor_id": slot.doctor_id,
            "doctor_name": slot.doctor_name,
            "specialty": slot.specialty,
            "appointment_at": slot.appointment_at.isoformat(),
        }

        await self.state_manager.set_state(
            phone,
            {"step": "CONFIRM_APPOINTMENT", "context": context},
            clinic_id=clinic_id,
        )

        when_label = slot.appointment_at.strftime("%d/%m/%Y")
        hour_label = slot.appointment_at.strftime("%H:%M")
        return IntakeResult(
            text=f"Encontré un turno disponible para {slot.specialty} el {when_label} a las {hour_label}. ¿Querés confirmarlo?"
        )

    async def _confirm_appointment(
        self,
        *,
        phone: str,
        clinic_id: str,
        client_id: str | None,
        phone_number_id: str | None,
        context: dict[str, Any],
    ) -> IntakeResult:
        slot_data = dict(context.get("candidate_slot") or {})
        lock_key = str(context.get("slot_lock_key") or "")
        if not slot_data or not lock_key:
            await self.state_manager.set_state(
                phone,
                {"step": "SEARCH_AVAILABILITY", "context": context},
                clinic_id=clinic_id,
            )
            return IntakeResult(text="Perdí el bloqueo del turno. Voy a buscar disponibilidad nuevamente.")

        try:
            patient = await self.api_client.upsert_whatsapp_patient(
                full_name=str(context.get("patient_full_name") or ""),
                dni=str(context.get("patient_dni") or ""),
                phone=str(context.get("patient_phone") or phone),
                email=str(context.get("patient_email") or "") or None,
                age=int(context.get("patient_age") or 0),
                social_security=str(context.get("social_security") or "") or None,
                clinic_id=clinic_id,
                client_id=client_id,
            )

            appointment_at = datetime.fromisoformat(str(slot_data.get("appointment_at")))
            appointment = await self.api_client.create_appointment(
                patient_id=str(patient.get("id") or ""),
                doctor_id=str(slot_data.get("doctor_id") or ""),
                appointment_at=appointment_at,
                reason="Solicitud generada desde WhatsApp | source=whatsapp_ai",
                social_security=str(context.get("social_security") or "") or None,
                clinic_id=clinic_id,
                client_id=client_id,
            )

            await self.scheduler.release_slot_lock(lock_key)
            await self.state_manager.set_state(
                phone,
                {"step": "COMPLETED", "context": context},
                clinic_id=clinic_id,
            )
            await self.state_manager.clear_state(phone, clinic_id=clinic_id)

            logger.info(
                "whatsapp_appointment_confirmed",
                extra={
                    "clinic_id": clinic_id,
                    "phone_number_id": phone_number_id,
                    "patient_phone": context.get("patient_phone") or phone,
                    "conversation_state": "COMPLETED",
                    "specialty": slot_data.get("specialty"),
                    "appointment_id": appointment.get("id"),
                    "error": None,
                },
            )

            day = appointment_at.strftime("%d/%m/%Y")
            hour = appointment_at.strftime("%H:%M")
            specialty = str(slot_data.get("specialty") or context.get("specialty") or "")
            social_security = str(context.get("social_security") or "Particular")
            return IntakeResult(
                text=(
                    f"Turno confirmado para {specialty} el {day} a las {hour}. "
                    f"Obra social registrada: {social_security}. Te esperamos con DNI."
                ),
                done=True,
                metadata={"appointment_id": appointment.get("id")},
            )
        except APIClientError as exc:
            await self.scheduler.release_slot_lock(lock_key)
            logger.error(
                "whatsapp_appointment_confirm_error",
                extra={
                    "clinic_id": clinic_id,
                    "phone_number_id": phone_number_id,
                    "patient_phone": context.get("patient_phone") or phone,
                    "conversation_state": "CONFIRM_APPOINTMENT",
                    "specialty": slot_data.get("specialty") or context.get("specialty"),
                    "appointment_id": None,
                    "error": str(exc),
                },
            )
            return IntakeResult(
                text=(
                    "Tu solicitud está registrada, pero tuve un problema al confirmar el turno. "
                    "La clínica lo revisará manualmente."
                )
            )
