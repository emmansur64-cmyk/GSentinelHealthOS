"""Orquestador conversacional del Brain."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from brain.core.config import settings
from brain.core.decision_core import process_input as _decision_core_process
from brain.core.state_manager import StateManager
from brain.decision_engine import triage_engine
from brain.integration.api_client import APIClient, APIClientError
from brain.services.appointment_scheduler_service import AppointmentSchedulerService
from brain.services.whatsapp_appointment_intake_service import WhatsAppAppointmentIntakeService
from brain.ml import no_show as no_show_engine
from MetaBrain.nlu_engine import NLUEngine
from brain.ml.no_show_predictor import predictor as no_show_predictor
from brain.orchestration.orchestrator import _contains_security_keyword, _SAFE_REDIRECT
from shared.utils import setup_logger

logger = setup_logger(__name__)


class BrainOrchestrator:
    """Coordina NLU, estado y llamadas a la API."""

    def __init__(
        self,
        *,
        state_manager: StateManager,
        api_client: APIClient,
        nlu_engine: type[NLUEngine] = NLUEngine,
    ) -> None:
        self.state_manager = state_manager
        self.api_client = api_client
        self.nlu_engine = nlu_engine
        self.no_show_predictor = no_show_predictor
        self.scheduler_service = AppointmentSchedulerService(
            api_client=api_client,
            state_manager=state_manager,
        )
        self.whatsapp_intake_service = WhatsAppAppointmentIntakeService(
            state_manager=state_manager,
            api_client=api_client,
            scheduler=self.scheduler_service,
        )

    async def handle_message(self, message: dict[str, Any]) -> dict[str, Any]:
        phone = self._resolve_phone(message)
        text = (message.get("text") or "").strip()
        tenant_client_id = message.get("client_id")
        tenant_clinic_id = message.get("clinic_id")

        if not phone:
            raise ValueError("El mensaje entrante no contiene telefono")

        if not text:
            return self._response(phone, "Necesito que me escribas un mensaje para poder ayudarte.")

        # ── Filtro server-side anti-jailbreak / anti-exfiltración ─────────────
        if _contains_security_keyword(text):
            logger.warning(
                "[SECURITY] Mensaje bloqueado por keyword en phone=%s: %.80s",
                phone, text,
            )
            return self._response(phone, _SAFE_REDIRECT)
        # ─────────────────────────────────────────────────────────────────────

        current_state = await self.state_manager.get_state(phone, clinic_id=tenant_clinic_id)
        
        # Obtener paciente para inferir el doctor_id (lecciones del médico)
        patient = await self.api_client.get_or_create_patient_by_phone(
            phone,
            client_id=tenant_client_id,
            clinic_id=tenant_clinic_id,
        )
        if not patient:
            logger.error("No se pudo resolver el shadow profile para %s", phone)
            return self._response(
                phone,
                "No pude validar tu perfil ahora mismo. Intenta nuevamente en unos minutos.",
            )
        
        # Intentar obtener doctor_id del appointment más reciente del paciente
        doctor_id = None
        try:
            appointments = await self.api_client.get_patient_appointments(
                patient.get("id", ""),
                client_id=tenant_client_id,
                clinic_id=tenant_clinic_id,
            )
            if appointments and isinstance(appointments, list):
                # Usar el primer appointment (más reciente) como referencia del doctor
                latest_appointment = appointments[0]
                doctor_id = latest_appointment.get("doctor_id")
        except Exception as e:
            logger.warning(f"No se pudo obtener appointments para inferir doctor: {e}")
        
        # Analizar con lecciones del doctor si está disponible
        if doctor_id:
            analysis = await self.nlu_engine.analyze_with_learning(
                text,
                doctor_id=doctor_id,
                history=current_state,
                api_client=self.api_client,
            )
        else:
            analysis = await self.nlu_engine.analyze(text, history=current_state)
        
        intent = analysis["intent"]

        intake_result = await self.whatsapp_intake_service.process(
            phone=phone,
            text=text,
            clinic_id=tenant_clinic_id,
            client_id=tenant_client_id,
            phone_number_id=str(message.get("phone_number_id") or "") or None,
            current_state=current_state,
            inferred_intent=intent,
        )
        if intake_result is not None:
            return self._response(phone, intake_result.text, metadata=intake_result.metadata)

        if intent == "SYSTEM_RESET":
            await self.state_manager.incr_metric("system_reset_total")
            await self.state_manager.clear_state(phone, clinic_id=tenant_clinic_id)
            return self._response(
                phone,
                "Entendido. Cancelamos el flujo actual. Cuando quieras, empezamos de nuevo.",
            )

        context = self._merge_context(current_state.get("context", {}), analysis["entities"], patient)
        if tenant_client_id:
            context["client_id"] = tenant_client_id
        if tenant_clinic_id:
            context["clinic_id"] = tenant_clinic_id
        step = current_state.get("step", "idle")

        if step == "awaiting_cancellation_selection":
            return await self._handle_cancellation_selection(phone, text, context)

        if step == "awaiting_doctor_selection":
            return await self._handle_doctor_selection(phone, text, context)

        if step == "awaiting_specialty" and context.get("specialty") is None:
            await self.state_manager.set_state(phone, {"step": "awaiting_specialty", "context": context}, clinic_id=tenant_clinic_id)
            return self._response(phone, "Necesito la especialidad medica para continuar. Por ejemplo: cardiologia o pediatria.")

        if step in {"awaiting_specialty", "awaiting_datetime"} or intent == "book_appointment":
            return await self._handle_booking(phone, text, context)

        if intent == "cancel_appointment":
            return await self._handle_cancellation(phone, context)

        # Evaluación clínica unificada via decision_core
        core_result = await _decision_core_process(
            text,
            context,
            nlu_result=analysis,
        )
        raw_triage = core_result["triage"].get("_raw_triage")
        if raw_triage is not None and raw_triage.matched_criteria:
            await self.state_manager.incr_metric("triage_evaluated_total")
            return self._response(
                phone,
                core_result["response"],
                metadata={
                    "triage_level": core_result["triage"]["triage_level"],
                    "risk_score": raw_triage.risk_score,
                    "matched_criteria": raw_triage.matched_criteria,
                    "flags": core_result["triage"]["flags"],
                },
            )

        # Sin criterios clínicos disparados: evaluar triage directo sobre el texto
        # para dar siempre una respuesta orientada (no "unknown").
        triage_out = triage_engine.evaluate_input({
            "symptoms": context.get("symptoms") or [text],
            "age": context.get("age"),
            "duration": context.get("duration_days"),
            "chronic_conditions": context.get("chronic_conditions") or [],
        })
        await self.state_manager.incr_metric("triage_evaluated_total")

        if triage_out["triage_level"] in {"rojo", "naranja"}:
            await self.state_manager.clear_state(phone, clinic_id=tenant_clinic_id)
            return self._response(
                phone,
                f"⚠️ Triage {triage_out['triage_level'].upper()}: {triage_out['action']}",
                metadata=triage_out,
            )

        if triage_out["triage_level"] in {"amarillo", "verde"}:
            return self._response(
                phone,
                f"Tus síntomas son de nivel {triage_out['triage_level']} (risk: {triage_out['risk_score']}).\n"
                f"{triage_out['action']}\n"
                "Puedo ayudarte a agendar un turno. Escribe: 'Quiero un turno con medico general'.",
                metadata=triage_out,
            )

        await self.state_manager.clear_state(phone, clinic_id=tenant_clinic_id)
        return self._response(
            phone,
            "Soy GSentinel Brain. Puedo ayudarte a agendar una cita medica. Escribe, por ejemplo: 'Quiero un turno con cardiologia manana a las 10'.",
        )

    async def _handle_booking(
        self,
        phone: str,
        text: str,
        context: dict[str, Any],
    ) -> dict[str, Any]:
        specialty = context.get("specialty")
        appointment_at = self._deserialize_datetime(context.get("appointment_at"))
        selected_doctor_id = context.get("selected_doctor_id")
        selected_doctor_name = context.get("selected_doctor_name")

        if specialty is None:
            await self.state_manager.set_state(
                phone,
                {"step": "awaiting_specialty", "context": context},
                clinic_id=context.get("clinic_id"),
            )
            return self._response(phone, "Claro. ¿Para que especialidad buscas turno?")

        if context.get("ambiguous_date"):
            await self.state_manager.set_state(
                phone,
                {"step": "awaiting_datetime", "context": context},
                clinic_id=context.get("clinic_id"),
            )
            return self._response(
                phone,
                f"Cuando dices '{context.get('date_hint')}', necesito confirmacion. Indicame una fecha concreta como 12/04 o '12 de abril a las 15:30'.",
            )

        if appointment_at is None:
            await self.state_manager.set_state(
                phone,
                {"step": "awaiting_datetime", "context": context},
                clinic_id=context.get("clinic_id"),
            )
            if context.get("missing_time") and context.get("date_hint"):
                return self._response(
                    phone,
                    f"Perfecto, ya tengo la fecha {context.get('date_hint')}. Ahora dime la hora, por ejemplo 'a las 15:30'.",
                )
            return self._response(
                phone,
                f"Entendido, buscare {specialty}. Ahora necesito fecha y hora de la cita.",
            )

        if appointment_at <= datetime.utcnow():
            await self.state_manager.set_state(
                phone,
                {"step": "awaiting_datetime", "context": context},
                clinic_id=context.get("clinic_id"),
            )
            return self._response(phone, "La fecha y hora deben estar en el futuro. Indicame otro horario.")

        if selected_doctor_id:
            # ── Predicción de no-show antes de confirmar el slot ─────────────
            context = await self._evaluate_no_show(phone, context, appointment_at)
            if context.get("_no_show_slot_blocked"):
                return self._response(
                    phone,
                    context["_no_show_slot_message"],
                    metadata={"no_show": context.get("no_show")},
                )
            return await self._finalize_booking(
                phone,
                context,
                {
                    "id": selected_doctor_id,
                    "name": selected_doctor_name or "el doctor asignado",
                    "specialty": specialty,
                },
            )

        doctors = await self.api_client.list_doctors_by_specialty(
            specialty,
            client_id=context.get("client_id"),
            clinic_id=context.get("clinic_id"),
        )
        if not doctors:
            await self.state_manager.set_state(
                phone,
                {"step": "awaiting_specialty", "context": context},
                clinic_id=context.get("clinic_id"),
            )
            return self._response(
                phone,
                f"No encontre doctores disponibles para {specialty}. Puedes indicarme otra especialidad.",
            )

        if len(doctors) > 1:
            options = [
                {
                    "id": doctor["id"],
                    "name": doctor.get("name", "Doctor sin nombre"),
                    "specialty": doctor.get("specialty", specialty),
                }
                for doctor in doctors
            ]
            context["doctor_options"] = options
            await self.state_manager.set_state(
                phone,
                {"step": "awaiting_doctor_selection", "context": context},
                clinic_id=context.get("clinic_id"),
            )
            return self._response(phone, self._build_doctor_selection_prompt(options, specialty))

        # ── Predicción de no-show antes de confirmar el slot ─────────────────
        context = await self._evaluate_no_show(phone, context, appointment_at)
        if context.get("_no_show_slot_blocked"):
            return self._response(
                phone,
                context["_no_show_slot_message"],
                metadata={"no_show": context.get("no_show")},
            )
        return await self._finalize_booking(phone, context, doctors[0])

    async def _handle_doctor_selection(
        self,
        phone: str,
        text: str,
        context: dict[str, Any],
    ) -> dict[str, Any]:
        options = context.get("doctor_options") or []
        selected = self._resolve_option_from_text(text, options)
        if selected is None:
            await self.state_manager.set_state(
                phone,
                {"step": "awaiting_doctor_selection", "context": context},
                clinic_id=context.get("clinic_id"),
            )
            return self._response(phone, self._build_doctor_selection_prompt(options, context.get("specialty")))

        context["selected_doctor_id"] = selected["id"]
        context["selected_doctor_name"] = selected.get("name")
        context.pop("doctor_options", None)
        appointment_at = self._deserialize_datetime(context.get("appointment_at"))
        if appointment_at is None:
            await self.state_manager.set_state(
                phone,
                {"step": "awaiting_datetime", "context": context},
                clinic_id=context.get("clinic_id"),
            )
            return self._response(
                phone,
                f"Perfecto, trabajaré con {selected.get('name')}. Ahora dime fecha y hora de la cita.",
            )

        return await self._finalize_booking(phone, context, selected)

    async def _handle_cancellation(
        self,
        phone: str,
        context: dict[str, Any],
    ) -> dict[str, Any]:
        appointments = await self.api_client.get_patient_appointments(
            context["patient_id"],
            client_id=context.get("client_id"),
            clinic_id=context.get("clinic_id"),
        )
        if not appointments:
            await self.state_manager.clear_state(phone, clinic_id=context.get("clinic_id"))
            return self._response(phone, "No encontre citas activas para cancelar.")

        if len(appointments) == 1:
            return await self._cancel_appointment(phone, context, appointments[0])

        options = [
            {
                "id": appointment["id"],
                "label": self._format_appointment_option(appointment, index),
            }
            for index, appointment in enumerate(appointments, start=1)
        ]
        context["cancellable_appointments"] = options
        await self.state_manager.set_state(
            phone,
            {"step": "awaiting_cancellation_selection", "context": context},
            clinic_id=context.get("clinic_id"),
        )
        prompt = "Estas son tus citas activas. Responde con el numero o el ID de la que quieres cancelar:\n"
        prompt += "\n".join(option["label"] for option in options)
        return self._response(phone, prompt)

    async def _handle_cancellation_selection(
        self,
        phone: str,
        text: str,
        context: dict[str, Any],
    ) -> dict[str, Any]:
        options = context.get("cancellable_appointments") or []
        selected = self._resolve_option_from_text(text, options)
        if selected is None:
            await self.state_manager.set_state(
                phone,
                {"step": "awaiting_cancellation_selection", "context": context},
                clinic_id=context.get("clinic_id"),
            )
            prompt = "No pude identificar la cita a cancelar. Responde con el numero o el ID exacto.\n"
            prompt += "\n".join(option["label"] for option in options)
            return self._response(phone, prompt)

        return await self._cancel_appointment(phone, context, selected)

    async def _cancel_appointment(
        self,
        phone: str,
        context: dict[str, Any],
        appointment: dict[str, Any],
    ) -> dict[str, Any]:
        try:
            cancelled = await self.api_client.cancel_appointment(
                appointment["id"],
                client_id=context.get("client_id"),
                clinic_id=context.get("clinic_id"),
            )
        except APIClientError as exc:
            await self.state_manager.set_state(
                phone,
                {"step": "awaiting_cancellation_selection", "context": context},
                clinic_id=context.get("clinic_id"),
            )
            return self._response(phone, f"No pude cancelar la cita: {exc}. Intenta nuevamente.")

        await self.state_manager.clear_state(phone, clinic_id=context.get("clinic_id"))
        date_label = self._format_datetime(cancelled.get("date_time"))
        return self._response(
            phone,
            f"La cita {cancelled.get('id')} del {date_label} fue cancelada correctamente.",
            metadata={"appointment_id": cancelled.get("id"), "status": cancelled.get("status")},
        )

    async def _finalize_booking(
        self,
        phone: str,
        context: dict[str, Any],
        doctor: dict[str, Any],
    ) -> dict[str, Any]:
        appointment_at = self._deserialize_datetime(context.get("appointment_at"))
        if appointment_at is None:
            await self.state_manager.set_state(
                phone,
                {"step": "awaiting_datetime", "context": context},
                clinic_id=context.get("clinic_id"),
            )
            return self._response(phone, "Necesito fecha y hora para confirmar la cita.")

        # Prediccion no-show en worker Brain (ONNX + fallback deterministico)
        no_show_probability = 0.0
        try:
            patient_history = await self.api_client.get_patient_appointments(
                context["patient_id"],
                client_id=context.get("client_id"),
                clinic_id=context.get("clinic_id"),
            )
            previous_cancellations = sum(
                1
                for appt in patient_history
                if str(appt.get("status", "")).strip().lower() == "cancelled"
            )
            age = context.get("age")
            if not isinstance(age, int):
                age = None

            prediction = self.no_show_predictor.predict(
                patient_history=patient_history,
                age=age,
                previous_cancellations=previous_cancellations,
                appointment_at=appointment_at,
            )
            no_show_probability = float(prediction.get("no_show_probability", 0.0))
            context["no_show_probability"] = no_show_probability
            context["previous_cancellations"] = previous_cancellations
        except Exception as exc:
            logger.warning("No se pudo calcular no-show en Brain worker: %s", exc)
        # Reutilizar predicción ya calculada por _evaluate_no_show (evita doble llamada).
        no_show_probability: float = context.get("no_show") or context.get("no_show_probability") or 0.0
        if not no_show_probability:
            try:
                no_show_probability = no_show_engine.predict({
                    "patient_history": await self.api_client.get_patient_appointments(
                        context.get("patient_id", ""),
                        client_id=context.get("client_id"),
                        clinic_id=context.get("clinic_id"),
                    ) or [],
                    "age": context.get("age") if isinstance(context.get("age"), int) else None,
                    "previous_cancellations": context.get("previous_cancellations") or 0,
                    "appointment_at": appointment_at,
                })
                context["no_show"] = round(no_show_probability, 4)
            except Exception as exc:
                logger.warning("No se pudo calcular no-show en _finalize_booking: %s", exc)

        try:
            reason = settings.default_appointment_reason
            if no_show_probability > 0:
                reason = f"{reason} | no_show_prob={no_show_probability:.3f}"

            appointment = await self.api_client.create_appointment(
                patient_id=context["patient_id"],
                doctor_id=doctor["id"],
                appointment_at=appointment_at,
                reason=reason,
                client_id=context.get("client_id"),
                clinic_id=context.get("clinic_id"),
            )
        except APIClientError as exc:
            await self.state_manager.set_state(
                phone,
                {"step": "awaiting_datetime", "context": context},
                clinic_id=context.get("clinic_id"),
            )
            return self._response(
                phone,
                f"No pude confirmar la cita: {exc}. Indica otro horario o intenta mas tarde.",
            )

        await self.state_manager.clear_state(phone, clinic_id=context.get("clinic_id"))
        doctor_name = doctor.get("name", "el doctor asignado")
        specialty = doctor.get("specialty") or context.get("specialty")
        date_label = appointment_at.strftime("%d/%m/%Y a las %H:%M")
        return self._response(
            phone,
            f"Tu cita fue registrada con {doctor_name} ({specialty}) para el {date_label}.",
            metadata={
                "appointment_id": appointment.get("id"),
                "doctor_id": doctor.get("id"),
                "patient_id": context.get("patient_id"),
                "no_show_probability": no_show_probability,
            },
        )

    @staticmethod
    def _resolve_phone(message: dict[str, Any]) -> str | None:
        return message.get("phone") or message.get("from")

    async def _evaluate_no_show(
        self,
        phone: str,
        context: dict[str, Any],
        appointment_at: datetime,
    ) -> dict[str, Any]:
        """Calcula la probabilidad de no-show y la almacena en ``context["no_show"]``.

        Si la probabilidad supera 0.7 **y** el slot es crítico (mañana en día hábil),
        marca ``context["_no_show_slot_blocked"] = True`` para que el caller
        redirija al usuario hacia un horario alternativo.
        """
        context = dict(context)  # copia defensiva
        try:
            patient_history = await self.api_client.get_patient_appointments(
                context.get("patient_id", ""),
                client_id=context.get("client_id"),
                clinic_id=context.get("clinic_id"),
            )
            age = context.get("age")
            if not isinstance(age, int):
                age = None
            previous_cancellations = sum(
                1
                for appt in (patient_history or [])
                if str(appt.get("status", "")).strip().lower() == "cancelled"
            )
            prob = no_show_engine.predict({
                "patient_history": patient_history or [],
                "age": age,
                "previous_cancellations": previous_cancellations,
                "appointment_at": appointment_at,
            })
            context["no_show"] = round(prob, 4)
            context["previous_cancellations"] = previous_cancellations
            logger.info(
                "[no_show] phone=%s prob=%.3f critical_slot=%s",
                phone,
                prob,
                no_show_engine.is_critical_slot(appointment_at),
            )

            if prob > 0.7 and no_show_engine.is_critical_slot(appointment_at):
                context["_no_show_slot_blocked"] = True
                context["_no_show_slot_message"] = (
                    f"⚠️ Detectamos alta probabilidad de ausentismo ({prob:.0%}) "
                    "para ese horario de alta demanda.\n"
                    "Te recomendamos elegir un turno en horario de tarde "
                    "(después de las 13:00) o cualquier horario del fin de semana. "
                    "Indicame una nueva fecha y hora."
                )
                await self.state_manager.set_state(
                    phone,
                    {"step": "awaiting_datetime", "context": context},
                    clinic_id=context.get("clinic_id"),
                )
        except Exception as exc:
            logger.warning("No se pudo calcular no-show en _evaluate_no_show: %s", exc)

        return context

    @staticmethod
    def _deserialize_datetime(value: Any) -> datetime | None:
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value)
            except ValueError:
                return None
        return None

    @classmethod
    def _merge_context(
        cls,
        stored_context: dict[str, Any],
        entities: dict[str, Any],
        patient: dict[str, Any],
    ) -> dict[str, Any]:
        context = dict(stored_context)
        incoming_specialty = entities.get("specialty")
        if incoming_specialty and incoming_specialty != context.get("specialty"):
            context.pop("selected_doctor_id", None)
            context.pop("selected_doctor_name", None)
            context.pop("doctor_options", None)
        for key, value in entities.items():
            if value is None:
                continue
            context[key] = value.isoformat() if isinstance(value, datetime) else value
        context["patient_id"] = patient["id"]
        context["patient_phone"] = patient.get("phone")
        return context

    @staticmethod
    def _resolve_option_from_text(text: str, options: list[dict[str, Any]]) -> dict[str, Any] | None:
        normalized = text.strip().lower()
        if normalized.isdigit():
            index = int(normalized) - 1
            if 0 <= index < len(options):
                return options[index]

        for option in options:
            option_id = str(option.get("id", "")).lower()
            option_name = str(option.get("name", option.get("label", ""))).lower()
            if normalized == option_id or normalized in option_name:
                return option

        return None

    @staticmethod
    def _build_doctor_selection_prompt(options: list[dict[str, Any]], specialty: str | None) -> str:
        header = f"Encontre varios doctores para {specialty}. Elige uno respondiendo con el numero o el nombre:\n"
        lines = [f"{index}. {option.get('name')}" for index, option in enumerate(options, start=1)]
        return header + "\n".join(lines)

    @staticmethod
    def _format_appointment_option(appointment: dict[str, Any], index: int) -> str:
        return f"{index}. {appointment.get('id')} - {BrainOrchestrator._format_datetime(appointment.get('date_time'))}"

    @staticmethod
    def _format_datetime(value: Any) -> str:
        parsed = BrainOrchestrator._deserialize_datetime(value)
        if parsed is None:
            return str(value)
        return parsed.strftime("%d/%m/%Y a las %H:%M")

    @staticmethod
    def _response(phone: str, text: str, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        payload: dict[str, Any] = {"phone": phone, "text": text}
        if metadata:
            payload["metadata"] = metadata
        return payload