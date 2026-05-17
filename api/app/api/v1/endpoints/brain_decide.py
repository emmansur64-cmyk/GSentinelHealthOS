"""Endpoint HTTP directo al motor NLU del Brain — POST /brain/decide.

Permite a clientes internos (SaaS, tests) obtener una decisión NLU sin pasar
por el bus de Redis. Usa la misma autenticación de API Key interna que el resto
de servicios internos (X-Internal-Key).

Respuesta:
  {
    "action": "book_appointment",     # intent normalizado
    "response": "...",                # texto para mostrar al usuario
    "confidence": 0.95,
    "source": "METABRAIN",
    "entities": { ... },
    "model_version": "metabrain-v1"
  }
"""

from __future__ import annotations

from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from api.app.core.security import InternalAuth, validate_api_key
from brain.contracts.core_contracts import (
    ContractValidationError,
    ModeGuardResult,
    default_forbidden_tools_for_mode,
    evaluate_mode_guard,
    normalize_assistant_mode,
    validate_runtime_brain_request,
)
from brain.interpreters.nlu_engine import NLUEngine
from shared.utils import setup_logger

logger = setup_logger(__name__)

router = APIRouter(
    prefix="/brain",
    tags=["brain"],
)


# ─── Schemas ──────────────────────────────────────────────────────────────────

class PatientCtx(BaseModel):
    id: str | None = None
    name: str | None = None
    notes: str | None = None


class AppointmentCtx(BaseModel):
    id: str | None = None
    datetime: str | None = None
    status: str | None = None
    notes: str | None = None


class ConversationTurn(BaseModel):
    doctor_message: str
    response: str


class DecideContext(BaseModel):
    doctor_id: str | None = None
    patient: PatientCtx | None = None
    current_appointment: AppointmentCtx | None = None
    recent_history: list[dict[str, Any]] = Field(default_factory=list)
    conversation_history: list[ConversationTurn] = Field(default_factory=list)
    clinical_state: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class DecideRequest(BaseModel):
    """Payload que envía el SaaS al Brain."""
    role: str = Field(..., description="Rol del solicitante: DOCTOR | PATIENT | SYSTEM")
    message: str = Field(..., min_length=1, max_length=4000)
    context: DecideContext = Field(default_factory=DecideContext)
    assistant_mode: str | None = Field(default=None, description="Modo asistente legacy/opcional")
    actor_role: str | None = Field(default=None, description="Rol runtime opcional")
    tenant_id: str | None = Field(default=None, description="Tenant runtime opcional")
    actor_id: str | None = Field(default=None, description="Actor runtime opcional")
    channel: str | None = Field(default=None, description="Canal runtime opcional")
    allowed_tools: list[str] | None = Field(default=None, description="Allowlist de herramientas")
    forbidden_tools: list[str] | None = Field(default=None, description="Denylist de herramientas")
    request_id: str | None = Field(default=None, description="Request ID opcional")


class DecideResponse(BaseModel):
    """Respuesta estructurada del motor NLU."""
    action: str
    response: str
    confidence: float
    source: str
    entities: dict[str, Any]
    model_version: str


# ─── Respuestas clínicas por intención ────────────────────────────────────────

_INTENT_RESPONSES: dict[str, str] = {
    "book_appointment": (
        "Entendido. Para agendar el turno, confirme la especialidad y la fecha deseada."
    ),
    "cancel_appointment": (
        "Entendido. Procedo a verificar el turno para su cancelación."
    ),
    "check_availability": (
        "Consultaré la disponibilidad de turnos para la especialidad solicitada."
    ),
    "SYSTEM_RESET": (
        "Flujo reiniciado. ¿En qué puedo ayudarle?"
    ),
    "general_query": (
        "He recibido su consulta. Por favor indique si desea agendar, cancelar "
        "o consultar disponibilidad de turnos."
    ),
}

_URGENT_KEYWORDS = (
    "dolor toracico", "disnea", "convulsion", "hemorragia",
    "shock", "stroke", "acv", "perdida de conciencia", "trauma",
    "fractura abierta", "sangrado", "asfixia",
)


def _check_urgency(message: str) -> bool:
    normalized = message.lower()
    import unicodedata
    normalized = "".join(
        c for c in unicodedata.normalize("NFD", normalized)
        if unicodedata.category(c) != "Mn"
    )
    return any(kw in normalized for kw in _URGENT_KEYWORDS)


def _build_clinical_response(
    message: str,
    intent: str,
    entities: dict[str, Any],
    context: DecideContext,
) -> str:
    """Construye una respuesta clínica contextualizada a partir del análisis NLU."""
    if _check_urgency(message):
        return (
            "⚠️ URGENCIA DETECTADA: Se recomienda derivación inmediata. "
            "El turno puede agendarse como URGENTE. Confirme para proceder."
        )

    parts: list[str] = [_INTENT_RESPONSES.get(intent, _INTENT_RESPONSES["general_query"])]

    if entities.get("specialty"):
        parts.append(f"Especialidad identificada: {entities['specialty']}.")

    if entities.get("target_date"):
        parts.append(f"Fecha solicitada: {entities['target_date']}.")

    if context.patient and context.patient.name:
        parts.append(f"Paciente: {context.patient.name}.")

    if context.current_appointment and intent in ("cancel_appointment", "book_appointment"):
        appt = context.current_appointment
        if appt.datetime:
            parts.append(f"Turno de referencia: {appt.datetime} (estado: {appt.status or 'desconocido'}).")

    return " ".join(parts)


def _map_role_to_actor_role(role: str) -> str:
    normalized = (role or "").strip().upper()
    if normalized == "DOCTOR":
        return "doctor"
    if normalized == "PATIENT":
        return "patient"
    return "system"


def _derive_assistant_mode(payload: DecideRequest) -> str:
    explicit_mode = normalize_assistant_mode(payload.assistant_mode)
    if payload.assistant_mode:
        return explicit_mode
    if (payload.role or "").strip().upper() == "DOCTOR":
        return "doctor_professional"
    return explicit_mode


def _tool_for_intent(intent: str) -> str | None:
    intent_tool_map = {
        "book_appointment": "appointment.write",
        "cancel_appointment": "appointment.write",
        "check_availability": "appointment.search_availability",
        "general_query": None,
        "SYSTEM_RESET": None,
    }
    return intent_tool_map.get(intent)


def _build_decide_contract_payload(payload: DecideRequest) -> dict[str, Any]:
    metadata = payload.context.metadata or {}
    mode = _derive_assistant_mode(payload)
    actor_role = str(payload.actor_role or _map_role_to_actor_role(payload.role))
    return {
        "request_id": str(payload.request_id or metadata.get("request_id") or uuid4()),
        "tenant_id": str(payload.tenant_id or metadata.get("tenant_id") or "unknown_tenant"),
        "actor_id": str(
            payload.actor_id
            or payload.context.doctor_id
            or metadata.get("actor_id")
            or f"{actor_role}_legacy"
        ),
        "actor_role": actor_role,
        "assistant_mode": mode,
        "channel": str(payload.channel or metadata.get("channel") or "web_chat"),
        "message": payload.message,
        "allowed_tools": list(payload.allowed_tools or metadata.get("allowed_tools") or []),
        "forbidden_tools": list(
            payload.forbidden_tools
            or metadata.get("forbidden_tools")
            or default_forbidden_tools_for_mode(mode)
        ),
    }


# ─── Endpoint ─────────────────────────────────────────────────────────────────

@router.post(
    "/decide",
    response_model=DecideResponse,
    status_code=status.HTTP_200_OK,
    summary="Decisión NLU del Brain",
    description=(
        "Procesa un mensaje con el motor NLU del Brain y retorna una decisión estructurada. "
        "Requiere X-Internal-Key. Motor MetaBrain nativo, sin dependencias externas de LLM."
    ),
)
async def brain_decide(
    payload: DecideRequest,
    auth: InternalAuth = Depends(validate_api_key),
) -> DecideResponse:
    if auth.service not in ("brain", "gateway"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo servicios con scope 'brain' o 'gateway' pueden invocar este endpoint",
        )

    contract_payload = _build_decide_contract_payload(payload)
    try:
        validated_mode = validate_runtime_brain_request(contract_payload)
    except ContractValidationError as exc:
        logger.warning(
            "Contract validation blocked /brain/decide request_id=%s mode=%s reason=%s",
            contract_payload.get("request_id"),
            contract_payload.get("assistant_mode"),
            str(exc),
        )
        return DecideResponse(
            action="CONTRACT_BLOCKED",
            response="Solicitud bloqueada por guardas de seguridad del asistente.",
            confidence=0.0,
            source="CONTRACT_GUARD",
            entities={"blocked": True, "assistant_mode": contract_payload.get("assistant_mode")},
            model_version="contract-guard-v1",
        )

    try:
        analysis = await NLUEngine.analyze(
            payload.message,
            learning_context="",
        )
    except Exception as exc:
        logger.error("Error en NLUEngine.analyze: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Motor NLU no disponible temporalmente",
        ) from exc

    intent: str = analysis.get("intent", "general_query")
    entities: dict[str, Any] = analysis.get("entities") or {}
    confidence: float = float(analysis.get("confidence") or 0.0)
    source: str = str(analysis.get("source") or "rules")

    requested_tool = _tool_for_intent(intent)
    if requested_tool:
        guard_result: ModeGuardResult = evaluate_mode_guard(validated_mode, requested_tool)
        if not guard_result.allowed:
            logger.warning(
                "Mode guard blocked /brain/decide request_id=%s mode=%s tool=%s reason=%s",
                contract_payload.get("request_id"),
                validated_mode,
                requested_tool,
                guard_result.reason,
            )
            return DecideResponse(
                action="CONTRACT_BLOCKED",
                response="La acción solicitada no está permitida para el modo actual.",
                confidence=0.0,
                source="CONTRACT_GUARD",
                entities={"blocked_tool": requested_tool, "assistant_mode": validated_mode},
                model_version="contract-guard-v1",
            )

    clinical_response = _build_clinical_response(
        payload.message,
        intent,
        entities,
        payload.context,
    )

    model_version = "metabrain-v1"

    logger.info(
        "brain/decide: intent=%s source=%s confidence=%.2f role=%s mode=%s",
        intent,
        source,
        confidence,
        payload.role,
        validated_mode,
    )

    return DecideResponse(
        action=intent,
        response=clinical_response,
        confidence=confidence,
        source=source,
        entities=entities,
        model_version=model_version,
    )
