"""Router de roles conversacionales — GSentinelH.

Responsabilidad única: determinar el pipeline de procesamiento
en base al ConversationalContract.

El router es DETERMINÍSTICO y EXPLÍCITO.
  - No infiere triage solo porque el texto parece médico.
  - No convierte texto libre en síntoma.
  - No tiene fallback global médico.

INVARIANT E (aislamiento doctor/paciente):
  Los pipelines DOCTOR y PATIENT son mutuamente excluyentes.
  Un médico NUNCA es tratado como paciente.

INVARIANT D (fail-safe):
  Si el router falla → SAFE_FALLBACK. NO triage.
"""

from __future__ import annotations

import logging
from typing import Any, Dict

from brain.contracts.routing import (
    ActorRole,
    AssistantMode,
    ConversationalContract,
    RoutingDecision,
    TriageEligibilityState,
    SAFE_FALLBACK_RESPONSE,
    build_contract,
)
from brain.routing.triage_eligibility import TriageEligibilityValidator, TriageEligibilityResult

logger = logging.getLogger(__name__)


class RoleRouter:
    """Router de roles. Determina el pipeline correcto para cada solicitud.

    Uso:
        contract = build_contract(mode_raw="doctor_professional", actor_role_raw="doctor")
        decision, eligibility = RoleRouter.route(
            contract=contract,
            intent="general_query",
            confidence=0.85,
            context={},
        )
    """

    @staticmethod
    def route(
        *,
        contract: ConversationalContract,
        intent: str,
        confidence: float,
        context: Dict[str, Any],
    ) -> tuple[RoutingDecision, TriageEligibilityResult]:
        """Determina el pipeline y el estado de elegibilidad de triage.

        Returns:
            (RoutingDecision, TriageEligibilityResult)

        Nunca lanza excepción. Si hay error → (SAFE_FALLBACK, NOT_TRIAGEABLE).
        """
        try:
            return RoleRouter._route_internal(
                contract=contract,
                intent=intent,
                confidence=confidence,
                context=context,
            )
        except Exception as exc:
            logger.error(
                "role_router.route: excepción → SAFE_FALLBACK: %s", exc
            )
            eligibility = TriageEligibilityResult(
                state=TriageEligibilityState.NOT_TRIAGEABLE,
                denied_reasons=[f"router_exception: {type(exc).__name__}"],
            )
            return RoutingDecision.SAFE_FALLBACK, eligibility

    @staticmethod
    def _route_internal(
        *,
        contract: ConversationalContract,
        intent: str,
        confidence: float,
        context: Dict[str, Any],
    ) -> tuple[RoutingDecision, TriageEligibilityResult]:
        mode = contract.mode

        # ── DOCTOR_PROFESSIONAL → siempre pipeline de médico ─────────────────
        if mode == AssistantMode.DOCTOR_PROFESSIONAL:
            eligibility = TriageEligibilityValidator.for_doctor_context(contract)
            logger.debug(
                "role_router: DOCTOR_PROFESSIONAL → DOCTOR_PIPELINE "
                "(intent=%s, triage=NEVER)", intent,
            )
            return RoutingDecision.DOCTOR_PIPELINE, eligibility

        # ── PATIENT_TRIAGE → validar elegibilidad completa ────────────────────
        if mode == AssistantMode.PATIENT_TRIAGE:
            eligibility = TriageEligibilityValidator.validate(
                contract=contract,
                intent=intent,
                confidence=confidence,
                context=context,
            )
            if eligibility.is_triage_eligible:
                logger.debug(
                    "role_router: PATIENT_TRIAGE → TRIAGE_PIPELINE (intent=%s)", intent
                )
                return RoutingDecision.TRIAGE_PIPELINE, eligibility
            else:
                logger.debug(
                    "role_router: PATIENT_TRIAGE → PATIENT_PIPELINE (triage denied: %s)",
                    eligibility.denied_reasons,
                )
                return RoutingDecision.PATIENT_PIPELINE, eligibility

        # ── PATIENT_ASSISTANT → pipeline de paciente sin triage ───────────────
        if mode == AssistantMode.PATIENT_ASSISTANT:
            eligibility = TriageEligibilityResult(
                state=TriageEligibilityState.ROUTE_PATIENT_ASSISTANT,
                reasons=["mode=patient_assistant_no_triage"],
            )
            return RoutingDecision.PATIENT_PIPELINE, eligibility

        # ── RECEPTIONIST / ADMINISTRATIVE → scheduling sin clínica ───────────
        if mode in {AssistantMode.RECEPTIONIST, AssistantMode.ADMINISTRATIVE}:
            eligibility = TriageEligibilityResult(
                state=TriageEligibilityState.ROUTE_GENERIC,
                reasons=[f"mode={mode.value}_non_clinical"],
            )
            return RoutingDecision.PATIENT_PIPELINE, eligibility

        # ── GENERIC_NON_CLINICAL o modo desconocido → safe fallback ──────────
        eligibility = TriageEligibilityResult(
            state=TriageEligibilityState.NOT_TRIAGEABLE,
            reasons=["mode=generic_non_clinical"],
            denied_reasons=["modo no clínico, sin pipeline de triage"],
        )
        logger.warning(
            "role_router: mode=%s sin pipeline definido → SAFE_FALLBACK", mode.value
        )
        return RoutingDecision.SAFE_FALLBACK, eligibility


def route_request(
    *,
    mode_raw: Any = None,
    actor_role_raw: Any = None,
    intent: str = "unknown",
    confidence: float = 0.0,
    context: Dict[str, Any] | None = None,
    session_id: str | None = None,
    doctor_id: str | None = None,
    patient_id: str | None = None,
    request_id: str | None = None,
) -> tuple[RoutingDecision, TriageEligibilityResult, "ConversationalContract"]:
    """Función de conveniencia. Construye el contrato y aplica el router.

    Retorna (decision, eligibility, contract).
    """
    contract = build_contract(
        mode_raw=mode_raw,
        actor_role_raw=actor_role_raw,
        session_id=session_id,
        doctor_id=doctor_id,
        patient_id=patient_id,
        request_id=request_id,
    )
    decision, eligibility = RoleRouter.route(
        contract=contract,
        intent=intent,
        confidence=confidence,
        context=context or {},
    )
    return decision, eligibility, contract
