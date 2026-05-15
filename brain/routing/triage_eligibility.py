"""Validador de elegibilidad de triage clínico.

Este módulo es la ÚNICA puerta de acceso al pipeline de triage.
Ningún módulo puede ejecutar triage sin pasar por esta validación.

INVARIANTES implementadas:

  INVARIANT A: DOCTOR_PROFESSIONAL → NOT_TRIAGEABLE (siempre)
  INVARIANT B: general_query, greeting, small_talk, etc. → ROUTE_GENERIC
  INVARIANT C: Triage requiere:
    - triage_allowed=True en el contrato
    - intent clínico explícito
    - síntomas detectados explícitamente (NO el user_input crudo)
    - confidence >= MIN_TRIAGE_CONFIDENCE
  INVARIANT D: Cualquier duda → estado más restrictivo
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from brain.contracts.routing import (
    AssistantMode,
    ClinicalCapabilities,
    ConversationalContract,
    CLINICAL_INTENTS,
    MIN_TRIAGE_CONFIDENCE,
    NON_TRIAGE_INTENTS,
    TriageEligibilityState,
)

logger = logging.getLogger(__name__)


@dataclass
class TriageEligibilityResult:
    """Resultado de la validación de elegibilidad de triage.

    `state` es el estado de routing determinado.
    `reasons` explica por qué se llegó a ese estado (para observabilidad).
    `explicit_symptoms` son los síntomas detectados explícitamente (nunca user_input crudo).
    `denied_reasons` son los motivos de rechazo si state != TRIAGE_ELIGIBLE.
    """
    state:             TriageEligibilityState
    reasons:           List[str] = field(default_factory=list)
    explicit_symptoms: List[str] = field(default_factory=list)
    denied_reasons:    List[str] = field(default_factory=list)

    @property
    def is_triage_eligible(self) -> bool:
        return self.state == TriageEligibilityState.TRIAGE_ELIGIBLE

    def to_trace(self) -> Dict[str, Any]:
        """Serializa el resultado para el audit trail."""
        return {
            "triage_eligibility_state": self.state.value,
            "triage_eligible":          self.is_triage_eligible,
            "reasons":                  self.reasons,
            "denied_reasons":           self.denied_reasons,
            "explicit_symptoms_count":  len(self.explicit_symptoms),
        }


class TriageEligibilityValidator:
    """Valida si una solicitud puede pasar al pipeline de triage.

    Punto de entrada único para toda decisión de triage.
    Implementa las cuatro invariantes del sistema.
    """

    @staticmethod
    def validate(
        *,
        contract: ConversationalContract,
        intent: str,
        confidence: float,
        context: Dict[str, Any],
    ) -> TriageEligibilityResult:
        """Determina el estado de elegibilidad de triage.

        Args:
            contract:   ConversationalContract con mode y capabilities.
            intent:     Intent detectado por el NLU.
            confidence: Confianza del NLU (0.0 – 1.0).
            context:    Contexto de sesión (puede contener 'symptoms').

        Returns:
            TriageEligibilityResult con el estado y trazabilidad.

        Nunca lanza excepción. Si algo falla → NOT_TRIAGEABLE.
        """
        try:
            return TriageEligibilityValidator._validate_internal(
                contract=contract,
                intent=intent,
                confidence=confidence,
                context=context,
            )
        except Exception as exc:
            logger.error(
                "triage_eligibility.validate: excepción inesperada → NOT_TRIAGEABLE: %s", exc
            )
            return TriageEligibilityResult(
                state=TriageEligibilityState.NOT_TRIAGEABLE,
                denied_reasons=[f"validation_exception: {type(exc).__name__}"],
            )

    @staticmethod
    def _validate_internal(
        *,
        contract: ConversationalContract,
        intent: str,
        confidence: float,
        context: Dict[str, Any],
    ) -> TriageEligibilityResult:
        """Implementación de la validación. Sin try/except interno."""

        # ── INVARIANT A: DOCTOR_PROFESSIONAL nunca hace triage ────────────────
        if contract.mode == AssistantMode.DOCTOR_PROFESSIONAL:
            logger.debug(
                "triage_eligibility: INVARIANT A — DOCTOR_PROFESSIONAL → NOT_TRIAGEABLE"
            )
            return TriageEligibilityResult(
                state=TriageEligibilityState.NOT_TRIAGEABLE,
                reasons=["INVARIANT_A: doctor_professional_mode_blocks_triage"],
                denied_reasons=["mode=doctor_professional: triage no permitido por contrato"],
            )

        # ── INVARIANT C (check 1): triage_allowed en el contrato ──────────────
        if not contract.capabilities.triage_allowed:
            logger.debug(
                "triage_eligibility: triage_allowed=False para mode=%s → NOT_TRIAGEABLE",
                contract.mode.value,
            )
            return TriageEligibilityResult(
                state=TriageEligibilityState.NOT_TRIAGEABLE,
                reasons=[f"capabilities.triage_allowed=False for mode={contract.mode.value}"],
                denied_reasons=["mode_capabilities_block_triage"],
            )

        # ── INVARIANT B: intents no clínicos → ROUTE_GENERIC ─────────────────
        normalized_intent = str(intent or "").lower().strip()
        if normalized_intent in NON_TRIAGE_INTENTS:
            logger.debug(
                "triage_eligibility: INVARIANT B — intent=%s → ROUTE_GENERIC", intent
            )
            return TriageEligibilityResult(
                state=TriageEligibilityState.ROUTE_GENERIC,
                reasons=[f"INVARIANT_B: non_clinical_intent={intent}"],
                denied_reasons=[f"intent '{intent}' no genera clasificación de síntomas"],
            )

        # ── INVARIANT C (check 2): intent debe ser clínico explícito ──────────
        if normalized_intent not in CLINICAL_INTENTS:
            logger.debug(
                "triage_eligibility: intent=%s no es clínico explícito → ROUTE_GENERIC", intent
            )
            return TriageEligibilityResult(
                state=TriageEligibilityState.ROUTE_GENERIC,
                reasons=[f"intent={intent} not in CLINICAL_INTENTS"],
                denied_reasons=["intent no reconocido como clínico explícito"],
            )

        # ── INVARIANT C (check 3): síntomas explícitos (no user_input crudo) ──
        explicit_symptoms = TriageEligibilityValidator._extract_explicit_symptoms(context)
        if not explicit_symptoms:
            logger.debug(
                "triage_eligibility: sin síntomas explícitos en contexto → ROUTE_GENERIC"
            )
            return TriageEligibilityResult(
                state=TriageEligibilityState.ROUTE_GENERIC,
                reasons=["no_explicit_symptoms_in_context"],
                denied_reasons=["triage requiere síntomas explícitos, no texto libre como síntoma"],
            )

        # ── INVARIANT C (check 4): confianza mínima ───────────────────────────
        if confidence < MIN_TRIAGE_CONFIDENCE:
            logger.debug(
                "triage_eligibility: confidence=%.2f < %.2f → ROUTE_GENERIC",
                confidence, MIN_TRIAGE_CONFIDENCE,
            )
            return TriageEligibilityResult(
                state=TriageEligibilityState.ROUTE_GENERIC,
                reasons=[f"confidence={confidence:.2f} < MIN_TRIAGE_CONFIDENCE={MIN_TRIAGE_CONFIDENCE}"],
                denied_reasons=["confianza insuficiente para triage"],
                explicit_symptoms=explicit_symptoms,
            )

        # ── Todos los criterios cumplidos → TRIAGE_ELIGIBLE ──────────────────
        logger.info(
            "triage_eligibility: TRIAGE_ELIGIBLE — intent=%s confidence=%.2f symptoms=%d",
            intent, confidence, len(explicit_symptoms),
        )
        return TriageEligibilityResult(
            state=TriageEligibilityState.TRIAGE_ELIGIBLE,
            reasons=[
                f"mode={contract.mode.value}",
                f"triage_allowed=True",
                f"intent={intent}",
                f"confidence={confidence:.2f}",
                f"explicit_symptoms={len(explicit_symptoms)}",
            ],
            explicit_symptoms=explicit_symptoms,
        )

    @staticmethod
    def _extract_explicit_symptoms(context: Dict[str, Any]) -> List[str]:
        """Extrae síntomas EXPLÍCITAMENTE declarados en el contexto.

        IMPORTANTE: El texto libre del usuario (user_input) NUNCA es tratado
        como síntoma aquí. Solo se aceptan síntomas del contexto estructurado.

        Fuentes aceptadas:
          - context["symptoms"]: list[str] ingresada por el usuario
          - context["patient_symptoms"]: del perfil del paciente
          - context["clinical_context"]["symptoms"]: del contexto clínico

        Fuentes RECHAZADAS (nunca usadas como síntoma):
          - user_input crudo
          - texto libre no validado
        """
        candidates: List[str] = []

        # Fuente 1: symptoms directo
        symptoms_raw = context.get("symptoms")
        if isinstance(symptoms_raw, list):
            candidates.extend(str(s).strip() for s in symptoms_raw if s and str(s).strip())
        elif isinstance(symptoms_raw, str) and symptoms_raw.strip():
            candidates.append(symptoms_raw.strip())

        # Fuente 2: patient_symptoms del perfil
        patient_symptoms = context.get("patient_symptoms")
        if isinstance(patient_symptoms, list):
            candidates.extend(
                str(s).strip() for s in patient_symptoms if s and str(s).strip()
            )

        # Fuente 3: clinical_context anidado
        clinical_ctx = context.get("clinical_context")
        if isinstance(clinical_ctx, dict):
            inner = clinical_ctx.get("symptoms")
            if isinstance(inner, list):
                candidates.extend(str(s).strip() for s in inner if s and str(s).strip())

        # Deduplicar manteniendo orden
        seen: set[str] = set()
        result: List[str] = []
        for s in candidates:
            normalized = s.lower()
            if normalized not in seen:
                seen.add(normalized)
                result.append(s)

        return result

    @staticmethod
    def for_doctor_context(contract: ConversationalContract) -> TriageEligibilityResult:
        """Shortcut para contextos de médico. Siempre retorna ROUTE_DOCTOR."""
        return TriageEligibilityResult(
            state=TriageEligibilityState.ROUTE_DOCTOR,
            reasons=["doctor_professional_mode"],
        )
