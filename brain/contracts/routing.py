"""Contratos formales de routing conversacional clínico — GSentinelH.

INVARIANTES (inmutables, no negociables):

  INVARIANT A:
    AssistantMode.DOCTOR_PROFESSIONAL NUNCA entra al pipeline de triage automático.
    Un médico preguntando "sabes qué día es hoy" NO puede generar una respuesta
    de urgencia clínica.

  INVARIANT B:
    Un intent `general_query` NUNCA genera clasificación automática de síntomas.
    El texto libre no es un síntoma por defecto.

  INVARIANT C:
    El triage solo se ejecuta si TODOS se cumplen simultáneamente:
      - capabilities.triage_allowed == True
      - intent clínico explícito (no general_query, greeting, small_talk, etc.)
      - confidence >= umbral mínimo (MIN_TRIAGE_CONFIDENCE)
      - síntomas detectados explícitamente (no el user_input crudo como síntoma)

  INVARIANT D:
    Si el router falla o recibe un modo desconocido:
      → fallback seguro no clínico (SAFE_FALLBACK_RESPONSE).
      → NO ejecutar triage.
      → NO generar respuesta médica.

  INVARIANT E:
    Pipelines DOCTOR y PATIENT son mutuamente excluyentes.
    Un médico jamás es tratado como paciente en el mismo pipeline.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Enumeraciones de contratos
# ─────────────────────────────────────────────────────────────────────────────

class AssistantMode(str, Enum):
    """Modo del asistente conversacional.

    Define el comportamiento permitido, las capacidades habilitadas
    y el pipeline de procesamiento activo.

    NO usar strings libres para este campo en ningún módulo del brain.
    """
    DOCTOR_PROFESSIONAL = "doctor_professional"
    PATIENT_ASSISTANT   = "patient_assistant"
    PATIENT_TRIAGE      = "patient_triage"
    RECEPTIONIST        = "receptionist"
    ADMINISTRATIVE      = "administrative"
    GENERIC_NON_CLINICAL = "generic_non_clinical"

    @classmethod
    def from_raw(cls, raw: Any) -> "AssistantMode":
        """Convierte un valor crudo en AssistantMode.

        Si el valor es inválido o desconocido → GENERIC_NON_CLINICAL.
        NUNCA levanta excepción: el modo inválido da el modo más restrictivo.
        """
        if isinstance(raw, cls):
            return raw
        try:
            return cls(str(raw).lower().strip())
        except ValueError:
            logger.warning(
                "contracts.AssistantMode: valor desconocido %r → GENERIC_NON_CLINICAL",
                raw,
            )
            return cls.GENERIC_NON_CLINICAL


class ActorRole(str, Enum):
    """Rol del actor que inicia la conversación."""
    DOCTOR      = "doctor"
    PATIENT     = "patient"
    RECEPTIONIST = "receptionist"
    ADMIN       = "admin"
    SYSTEM      = "system"

    @classmethod
    def from_raw(cls, raw: Any) -> "ActorRole":
        if isinstance(raw, cls):
            return raw
        try:
            return cls(str(raw).lower().strip())
        except ValueError:
            logger.warning(
                "contracts.ActorRole: valor desconocido %r → SYSTEM (más restrictivo)",
                raw,
            )
            return cls.SYSTEM


class TriageEligibilityState(str, Enum):
    """Estado de elegibilidad para ejecutar triage clínico.

    Posibles estados y sus semánticas:

      NOT_TRIAGEABLE      → el modo o rol no permite triage (INVARIANT A).
      ROUTE_GENERIC       → texto no clínico, sin síntomas detectados.
      ROUTE_DOCTOR        → contexto de médico, responder como asistente profesional.
      ROUTE_PATIENT_ASSISTANT → contexto de paciente, sin triage activo.
      TRIAGE_ELIGIBLE     → todos los criterios cumplidos, triage permitido.

    VERDE nunca es el default. El estado por defecto es ROUTE_GENERIC.
    """
    NOT_TRIAGEABLE        = "NOT_TRIAGEABLE"
    ROUTE_GENERIC         = "ROUTE_GENERIC"
    ROUTE_DOCTOR          = "ROUTE_DOCTOR"
    ROUTE_PATIENT_ASSISTANT = "ROUTE_PATIENT_ASSISTANT"
    TRIAGE_ELIGIBLE       = "TRIAGE_ELIGIBLE"


class RoutingDecision(str, Enum):
    """Decisión de routing tomada por el role_router."""
    DOCTOR_PIPELINE   = "DOCTOR_PIPELINE"
    PATIENT_PIPELINE  = "PATIENT_PIPELINE"
    TRIAGE_PIPELINE   = "TRIAGE_PIPELINE"
    SAFE_FALLBACK     = "SAFE_FALLBACK"
    REJECTED          = "REJECTED"


# ─────────────────────────────────────────────────────────────────────────────
# Capacidades clínicas por modo
# ─────────────────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class ClinicalCapabilities:
    """Capacidades clínicas habilitadas para un modo de asistente.

    Todos los campos son False por defecto (principio de mínimo privilegio).
    """
    triage_allowed:             bool = False
    diagnosis_allowed:          bool = False
    scheduling_allowed:         bool = False
    clinical_reasoning_allowed: bool = False
    imaging_allowed:            bool = False
    prescription_review_allowed: bool = False


# Tabla de capacidades por modo. Inmutable. NO modificar sin revisión de seguridad.
_CAPABILITIES_MAP: Dict[AssistantMode, ClinicalCapabilities] = {
    AssistantMode.DOCTOR_PROFESSIONAL: ClinicalCapabilities(
        triage_allowed=False,               # INVARIANT A: NUNCA triage automático
        diagnosis_allowed=False,            # No diagnóstico automático
        scheduling_allowed=True,
        clinical_reasoning_allowed=True,    # Puede asistir razonamiento clínico del médico
        imaging_allowed=True,               # Preparado para futuras capas RMN/TAC/RX
        prescription_review_allowed=False,
    ),
    AssistantMode.PATIENT_ASSISTANT: ClinicalCapabilities(
        triage_allowed=False,
        diagnosis_allowed=False,
        scheduling_allowed=True,
        clinical_reasoning_allowed=False,
        imaging_allowed=False,
    ),
    AssistantMode.PATIENT_TRIAGE: ClinicalCapabilities(
        triage_allowed=True,                # Único modo con triage habilitado
        diagnosis_allowed=False,
        scheduling_allowed=True,
        clinical_reasoning_allowed=False,
        imaging_allowed=False,
    ),
    AssistantMode.RECEPTIONIST: ClinicalCapabilities(
        triage_allowed=False,
        diagnosis_allowed=False,
        scheduling_allowed=True,
        clinical_reasoning_allowed=False,
        imaging_allowed=False,
    ),
    AssistantMode.ADMINISTRATIVE: ClinicalCapabilities(
        triage_allowed=False,
        diagnosis_allowed=False,
        scheduling_allowed=True,
        clinical_reasoning_allowed=False,
        imaging_allowed=False,
    ),
    AssistantMode.GENERIC_NON_CLINICAL: ClinicalCapabilities(
        # Sin ninguna capacidad clínica. El modo más restrictivo.
    ),
}


def get_capabilities(mode: AssistantMode) -> ClinicalCapabilities:
    """Retorna las capacidades clínicas para un modo.

    Si el modo no está registrado → ClinicalCapabilities() (todas False).
    """
    return _CAPABILITIES_MAP.get(mode, ClinicalCapabilities())


# ─────────────────────────────────────────────────────────────────────────────
# Intents que NUNCA generan triage (contrato explícito)
# ─────────────────────────────────────────────────────────────────────────────

NON_TRIAGE_INTENTS: frozenset[str] = frozenset({
    "greeting",
    "farewell",
    "help",
    "unknown",
    "small_talk",
    "general_query",        # INVARIANT B: nunca genera clasificación de síntomas
    "booking",
    "cancel_booking",
    "book_appointment",
    "cancel_appointment",
    "check_availability",
    "SYSTEM_RESET",
    "administrative",
    "schedule_query",
    "confirmation",
})

# Intents clínicos explícitos (únicos que pueden llegar a triage)
CLINICAL_INTENTS: frozenset[str] = frozenset({
    "symptom_report",
    "clinical_query",
    "urgent_symptom",
    "triage_request",
    "clinical_case",
    "pain_report",
    "medical_complaint",
})

# Umbral mínimo de confianza para habilitar triage (INVARIANT C)
MIN_TRIAGE_CONFIDENCE: float = 0.65


# ─────────────────────────────────────────────────────────────────────────────
# Contrato conversacional
# ─────────────────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class ConversationalContract:
    """Contrato completo de una conversación.

    Es el objeto que fluye desde el frontend hasta el motor de decisión,
    reemplazando el uso de strings libres para configurar el comportamiento
    del sistema.

    Todos los módulos del pipeline deben respetar los invariantes expresados
    en este contrato. Si `mode` no permite triage → triage NUNCA se ejecuta,
    independientemente de lo que diga el NLU.
    """
    mode:         AssistantMode
    actor_role:   ActorRole
    capabilities: ClinicalCapabilities
    session_id:   Optional[str] = None
    tenant_id:    Optional[str] = None
    doctor_id:    Optional[str] = None
    patient_id:   Optional[str] = None
    request_id:   Optional[str] = None
    extra:        Dict[str, Any] = field(default_factory=dict)

    @property
    def is_doctor_mode(self) -> bool:
        return self.mode == AssistantMode.DOCTOR_PROFESSIONAL

    @property
    def is_patient_triage_mode(self) -> bool:
        return self.mode == AssistantMode.PATIENT_TRIAGE

    @property
    def triage_allowed(self) -> bool:
        """INVARIANT A: DOCTOR_PROFESSIONAL nunca tiene triage permitido."""
        return self.capabilities.triage_allowed

    def to_context_dict(self) -> Dict[str, Any]:
        """Serializa el contrato para inyectarlo en el contexto del pipeline."""
        return {
            "_contract_mode":       self.mode.value,
            "_contract_actor_role": self.actor_role.value,
            "_triage_allowed":      self.triage_allowed,
            "_clinical_reasoning":  self.capabilities.clinical_reasoning_allowed,
            "_imaging_allowed":     self.capabilities.imaging_allowed,
            "_scheduling_allowed":  self.capabilities.scheduling_allowed,
            "_doctor_id":           self.doctor_id,
            "_patient_id":          self.patient_id,
            "_request_id":          self.request_id,
        }


# ─────────────────────────────────────────────────────────────────────────────
# Respuestas seguras
# ─────────────────────────────────────────────────────────────────────────────

SAFE_FALLBACK_RESPONSE = (
    "No puedo procesar esa consulta en este momento. "
    "Por favor, intentá nuevamente o contactá al soporte."
)

DOCTOR_NON_CLINICAL_RESPONSE_PREFIX = "Como asistente clínico para el médico"

TRIAGE_BLOCKED_RESPONSE = (
    "Esta consulta no puede ser procesada como triage automático. "
    "Si es una emergencia, llamar al 911."
)


# ─────────────────────────────────────────────────────────────────────────────
# Factory de contratos
# ─────────────────────────────────────────────────────────────────────────────

def build_contract(
    *,
    mode_raw: Any = None,
    actor_role_raw: Any = None,
    session_id: Optional[str] = None,
    tenant_id: Optional[str] = None,
    doctor_id: Optional[str] = None,
    patient_id: Optional[str] = None,
    request_id: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> ConversationalContract:
    """Construye un ConversationalContract con validación completa.

    Si mode_raw es inválido → GENERIC_NON_CLINICAL (principio fail-safe).
    Si actor_role_raw es inválido → SYSTEM (más restrictivo).

    NUNCA lanza excepción: devuelve el contrato más restrictivo posible
    si los parámetros son inválidos.
    """
    mode = AssistantMode.from_raw(mode_raw)
    role = ActorRole.from_raw(actor_role_raw)
    caps = get_capabilities(mode)

    contract = ConversationalContract(
        mode=mode,
        actor_role=role,
        capabilities=caps,
        session_id=session_id,
        tenant_id=tenant_id,
        doctor_id=doctor_id,
        patient_id=patient_id,
        request_id=request_id,
        extra=extra or {},
    )

    logger.debug(
        "contracts.build_contract: mode=%s role=%s triage_allowed=%s",
        mode.value, role.value, caps.triage_allowed,
    )

    return contract
