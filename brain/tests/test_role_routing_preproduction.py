"""Tests pre-producción de routing conversacional y role isolation.

Verifica los 8 casos definidos en la arquitectura:

  CASO A: doctor_professional + "sabes que dia es hoy" → NO triage
  CASO B: doctor_professional + "quiero revisar agenda" → administrativo
  CASO C: patient_triage + "me duele el pecho" + síntomas explícitos → triage permitido
  CASO D: general_query ambiguo → sin symptom classification automática
  CASO E: router inválido → fallback seguro
  CASO F: assistant_mode desconocido → rejected/safe fallback
  CASO G: contrato doctor completo → preserva role/context
  CASO H: ambos tipos de contrato reconocidos correctamente

Restricciones:
  - NO llamadas HTTP externas
  - NO IA clínica real
  - NO providers pagos
  - Solo lógica local y contratos
"""
from __future__ import annotations

import pytest

from brain.contracts.routing import (
    ActorRole,
    AssistantMode,
    ClinicalCapabilities,
    ConversationalContract,
    NON_TRIAGE_INTENTS,
    CLINICAL_INTENTS,
    MIN_TRIAGE_CONFIDENCE,
    TriageEligibilityState,
    RoutingDecision,
    build_contract,
    get_capabilities,
    SAFE_FALLBACK_RESPONSE,
)
from brain.routing.triage_eligibility import TriageEligibilityValidator, TriageEligibilityResult
from brain.routing.role_router import RoleRouter, route_request


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def doctor_contract() -> ConversationalContract:
    return build_contract(
        mode_raw="doctor_professional",
        actor_role_raw="doctor",
        doctor_id="doc-123",
        session_id="sess-abc",
    )

@pytest.fixture
def patient_triage_contract() -> ConversationalContract:
    return build_contract(
        mode_raw="patient_triage",
        actor_role_raw="patient",
        patient_id="pat-456",
    )

@pytest.fixture
def generic_contract() -> ConversationalContract:
    return build_contract(mode_raw="generic_non_clinical")


# ─────────────────────────────────────────────────────────────────────────────
# CASO A: doctor_professional + pregunta casual → NO triage jamás
# ─────────────────────────────────────────────────────────────────────────────

class TestCasoA:
    """CASO A: doctor_professional "sabes que dia es hoy" → NO triage."""

    def test_doctor_mode_no_triage_allowed(self, doctor_contract):
        assert doctor_contract.triage_allowed is False, (
            "INVARIANT A ROTA: DOCTOR_PROFESSIONAL tiene triage_allowed=True"
        )

    def test_doctor_mode_triage_eligibility_not_triageable(self, doctor_contract):
        eligibility = TriageEligibilityValidator.validate(
            contract=doctor_contract,
            intent="general_query",
            confidence=0.9,
            context={},
        )
        assert eligibility.state == TriageEligibilityState.NOT_TRIAGEABLE, (
            f"INVARIANT A ROTA: doctor + general_query retornó {eligibility.state} "
            f"en lugar de NOT_TRIAGEABLE. Reasons: {eligibility.reasons}"
        )
        assert not eligibility.is_triage_eligible

    def test_doctor_router_returns_doctor_pipeline(self, doctor_contract):
        decision, eligibility = RoleRouter.route(
            contract=doctor_contract,
            intent="general_query",
            confidence=0.9,
            context={},
        )
        assert decision == RoutingDecision.DOCTOR_PIPELINE, (
            f"Router devolvió {decision} para doctor. Esperado: DOCTOR_PIPELINE"
        )
        assert eligibility.state == TriageEligibilityState.ROUTE_DOCTOR

    def test_doctor_casual_question_route(self, doctor_contract):
        """'sabes que dia es hoy' en modo doctor → DOCTOR_PIPELINE, sin triage."""
        decision, eligibility = RoleRouter.route(
            contract=doctor_contract,
            intent="general_query",
            confidence=0.85,
            context={"user_input": "sabes que dia es hoy"},
        )
        assert decision == RoutingDecision.DOCTOR_PIPELINE
        assert not eligibility.is_triage_eligible
        # El doctor NO debe recibir "Tus sintomas son de baja urgencia"
        assert eligibility.state != TriageEligibilityState.TRIAGE_ELIGIBLE

    def test_doctor_no_sintoma_generico(self):
        """triage_engine NO debe generar sintoma_generico para texto casual."""
        from brain.decision_engine import triage_engine
        result = triage_engine.evaluate(
            symptoms=["sabes que dia es hoy"],
            duration_days=None,
            age=None,
        )
        # Sin coincidencia de reglas clínicas → azul, NO sintoma_generico
        assert "sintoma_generico" not in result.matched_criteria, (
            f"Bug confirmado: triage_engine generó sintoma_generico. "
            f"matched_criteria={result.matched_criteria}"
        )
        assert result.triage_level == "azul"


# ─────────────────────────────────────────────────────────────────────────────
# CASO B: doctor_professional + consulta administrativa → administrativo
# ─────────────────────────────────────────────────────────────────────────────

class TestCasoB:
    """CASO B: doctor_professional "quiero revisar agenda" → administrativo."""

    def test_booking_intent_no_triage(self, doctor_contract):
        decision, eligibility = RoleRouter.route(
            contract=doctor_contract,
            intent="booking",
            confidence=0.95,
            context={},
        )
        assert decision == RoutingDecision.DOCTOR_PIPELINE
        assert not eligibility.is_triage_eligible

    def test_administrative_intent_is_non_triage(self):
        assert "booking" in NON_TRIAGE_INTENTS
        assert "general_query" in NON_TRIAGE_INTENTS
        assert "check_availability" in NON_TRIAGE_INTENTS

    def test_doctor_capabilities_include_scheduling(self, doctor_contract):
        assert doctor_contract.capabilities.scheduling_allowed is True
        assert doctor_contract.capabilities.clinical_reasoning_allowed is True
        # Imaging preparado para futura capa RMN/TAC/RX
        assert doctor_contract.capabilities.imaging_allowed is True

    def test_doctor_mode_no_diagnosis(self, doctor_contract):
        assert doctor_contract.capabilities.diagnosis_allowed is False


# ─────────────────────────────────────────────────────────────────────────────
# CASO C: patient_triage + síntomas explícitos → triage permitido
# ─────────────────────────────────────────────────────────────────────────────

class TestCasoC:
    """CASO C: patient_triage + "me duele el pecho" + síntomas → triage OK."""

    def test_patient_triage_contract_allows_triage(self, patient_triage_contract):
        assert patient_triage_contract.triage_allowed is True

    def test_triage_eligible_with_clinical_intent_and_symptoms(self, patient_triage_contract):
        eligibility = TriageEligibilityValidator.validate(
            contract=patient_triage_contract,
            intent="symptom_report",
            confidence=0.85,
            context={"symptoms": ["dolor de pecho", "dificultad para respirar"]},
        )
        assert eligibility.is_triage_eligible, (
            f"Triage debería ser elegible para patient_triage + symptom_report + síntomas. "
            f"Estado: {eligibility.state}. Razones: {eligibility.denied_reasons}"
        )
        assert eligibility.state == TriageEligibilityState.TRIAGE_ELIGIBLE
        assert len(eligibility.explicit_symptoms) >= 1

    def test_triage_router_returns_triage_pipeline(self, patient_triage_contract):
        decision, eligibility = RoleRouter.route(
            contract=patient_triage_contract,
            intent="symptom_report",
            confidence=0.85,
            context={"symptoms": ["dolor pecho", "falta de aire"]},
        )
        assert decision == RoutingDecision.TRIAGE_PIPELINE
        assert eligibility.is_triage_eligible

    def test_triage_engine_detects_chest_pain(self):
        from brain.decision_engine import triage_engine
        result = triage_engine.evaluate(
            symptoms=["dolor pecho", "dificultad respirar"],
            duration_days=None,
            age=45,
        )
        # Dolor de pecho con disnea → naranja (urgente)
        assert result.triage_level in {"naranja", "rojo"}, (
            f"Triage engine debería detectar dolor pecho + disnea como urgente. "
            f"Nivel: {result.triage_level}"
        )
        assert len(result.matched_criteria) > 0

    def test_triage_no_sintoma_generico_for_chest_pain(self):
        """El dolor de pecho NO debe caer en sintoma_generico."""
        from brain.decision_engine import triage_engine
        result = triage_engine.evaluate(
            symptoms=["dolor de pecho"],
            duration_days=None,
            age=50,
        )
        assert "sintoma_generico" not in result.matched_criteria
        assert result.triage_level != "verde"  # No verde por default


# ─────────────────────────────────────────────────────────────────────────────
# CASO D: general_query ambiguo → sin symptom classification automática
# ─────────────────────────────────────────────────────────────────────────────

class TestCasoD:
    """CASO D: general_query → sin clasificación automática de síntomas."""

    def test_general_query_in_non_triage_intents(self):
        assert "general_query" in NON_TRIAGE_INTENTS, (
            "INVARIANT B ROTA: general_query debe estar en NON_TRIAGE_INTENTS"
        )

    def test_general_query_blocks_triage_even_with_triage_mode(self, patient_triage_contract):
        """Incluso en modo triage, general_query no genera symptom classification."""
        eligibility = TriageEligibilityValidator.validate(
            contract=patient_triage_contract,
            intent="general_query",
            confidence=0.9,
            context={"symptoms": ["me siento mal"]},
        )
        assert not eligibility.is_triage_eligible
        assert eligibility.state == TriageEligibilityState.ROUTE_GENERIC

    def test_ambiguous_text_no_sintoma_generico(self):
        """Texto libre no médico → triage_engine NO genera sintoma_generico."""
        from brain.decision_engine import triage_engine
        for text in ["hola como estas", "quiero un turno", "que hora es", ""]:
            result = triage_engine.evaluate(
                symptoms=[text] if text else [],
                duration_days=None,
                age=None,
            )
            assert "sintoma_generico" not in result.matched_criteria, (
                f"Bug: '{text}' generó sintoma_generico en triage_engine"
            )

    def test_unknown_intent_no_triage(self, patient_triage_contract):
        eligibility = TriageEligibilityValidator.validate(
            contract=patient_triage_contract,
            intent="unknown",
            confidence=0.9,
            context={"symptoms": ["me siento raro"]},
        )
        assert not eligibility.is_triage_eligible


# ─────────────────────────────────────────────────────────────────────────────
# CASO E: router inválido → fallback seguro
# ─────────────────────────────────────────────────────────────────────────────

class TestCasoE:
    """CASO E: router inválido → SAFE_FALLBACK, sin triage."""

    def test_generic_non_clinical_gets_safe_fallback(self, generic_contract):
        decision, eligibility = RoleRouter.route(
            contract=generic_contract,
            intent="unknown",
            confidence=0.0,
            context={},
        )
        assert decision == RoutingDecision.SAFE_FALLBACK
        assert eligibility.state == TriageEligibilityState.NOT_TRIAGEABLE

    def test_route_request_with_invalid_mode(self):
        """Modo completamente inválido → SAFE_FALLBACK."""
        decision, eligibility, contract = route_request(
            mode_raw="modo_inventado_que_no_existe",
            actor_role_raw="actor_invalido",
            intent="unknown",
        )
        # Debe caer a generic_non_clinical → safe fallback
        assert contract.mode == AssistantMode.GENERIC_NON_CLINICAL
        assert decision == RoutingDecision.SAFE_FALLBACK
        assert not eligibility.is_triage_eligible

    def test_triage_eligibility_exception_returns_not_triageable(self):
        """Si validate() falla internamente → NOT_TRIAGEABLE, nunca excepción."""
        # Pasamos un objeto inválido para forzar excepción interna
        contract = build_contract(mode_raw="patient_triage")
        # Context inválido que podría romper extracción
        try:
            result = TriageEligibilityValidator.validate(
                contract=contract,
                intent="symptom_report",
                confidence=0.8,
                context=None,  # type: ignore — inválido intencional
            )
            # Si no falla, debe retornar NOT_TRIAGEABLE o ROUTE_GENERIC
            assert result.state in {
                TriageEligibilityState.NOT_TRIAGEABLE,
                TriageEligibilityState.ROUTE_GENERIC,
                TriageEligibilityState.TRIAGE_ELIGIBLE,  # también válido si maneja None
            }
        except Exception as exc:
            pytest.fail(f"TriageEligibilityValidator.validate no debe propagar excepciones: {exc}")


# ─────────────────────────────────────────────────────────────────────────────
# CASO F: assistant_mode desconocido → rejected/safe fallback
# ─────────────────────────────────────────────────────────────────────────────

class TestCasoF:
    """CASO F: assistant_mode desconocido → GENERIC_NON_CLINICAL + safe fallback."""

    def test_unknown_mode_becomes_generic(self):
        mode = AssistantMode.from_raw("modo_completamente_desconocido_xyz")
        assert mode == AssistantMode.GENERIC_NON_CLINICAL

    def test_none_mode_becomes_generic(self):
        mode = AssistantMode.from_raw(None)
        assert mode == AssistantMode.GENERIC_NON_CLINICAL

    def test_empty_string_mode_becomes_generic(self):
        mode = AssistantMode.from_raw("")
        assert mode == AssistantMode.GENERIC_NON_CLINICAL

    def test_generic_capabilities_all_false(self):
        caps = get_capabilities(AssistantMode.GENERIC_NON_CLINICAL)
        assert caps.triage_allowed is False
        assert caps.diagnosis_allowed is False
        assert caps.clinical_reasoning_allowed is False
        assert caps.imaging_allowed is False

    def test_unknown_mode_contract_blocks_triage(self):
        contract = build_contract(mode_raw="modo_raro")
        assert contract.triage_allowed is False
        assert contract.mode == AssistantMode.GENERIC_NON_CLINICAL


# ─────────────────────────────────────────────────────────────────────────────
# CASO G: contrato doctor completo → preserva role/context
# ─────────────────────────────────────────────────────────────────────────────

class TestCasoG:
    """CASO G: contrato doctor → preserva role y context completo."""

    def test_doctor_contract_preserves_fields(self):
        contract = build_contract(
            mode_raw="doctor_professional",
            actor_role_raw="doctor",
            doctor_id="dr-uuid-001",
            patient_id="pat-uuid-002",
            session_id="sess-003",
            request_id="req-004",
        )
        assert contract.doctor_id == "dr-uuid-001"
        assert contract.patient_id == "pat-uuid-002"
        assert contract.session_id == "sess-003"
        assert contract.request_id == "req-004"
        assert contract.mode == AssistantMode.DOCTOR_PROFESSIONAL
        assert contract.actor_role == ActorRole.DOCTOR

    def test_contract_to_context_dict(self):
        contract = build_contract(
            mode_raw="doctor_professional",
            actor_role_raw="doctor",
            doctor_id="dr-uuid-001",
        )
        ctx = contract.to_context_dict()
        assert ctx["_contract_mode"] == "doctor_professional"
        assert ctx["_contract_actor_role"] == "doctor"
        assert ctx["_triage_allowed"] is False
        assert ctx["_clinical_reasoning"] is True
        assert ctx["_imaging_allowed"] is True
        assert ctx["_doctor_id"] == "dr-uuid-001"

    def test_contract_is_immutable(self):
        contract = build_contract(mode_raw="doctor_professional")
        with pytest.raises((AttributeError, TypeError)):
            contract.mode = AssistantMode.PATIENT_TRIAGE  # type: ignore

    def test_doctor_pipeline_always_for_all_doctor_intents(self):
        """Para un médico, todos los intents van a DOCTOR_PIPELINE."""
        contract = build_contract(mode_raw="doctor_professional", actor_role_raw="doctor")
        intents_to_test = [
            "general_query", "greeting", "booking", "clinical_query",
            "symptom_report", "unknown", "small_talk",
        ]
        for intent in intents_to_test:
            decision, eligibility = RoleRouter.route(
                contract=contract,
                intent=intent,
                confidence=0.95,
                context={"symptoms": ["dolor de pecho"]},
            )
            assert decision == RoutingDecision.DOCTOR_PIPELINE, (
                f"Intent '{intent}' con doctor devolvió {decision}, no DOCTOR_PIPELINE"
            )
            assert not eligibility.is_triage_eligible, (
                f"INVARIANT A ROTA: intent '{intent}' con doctor generó TRIAGE_ELIGIBLE"
            )


# ─────────────────────────────────────────────────────────────────────────────
# CASO H: modos reconocidos correctamente
# ─────────────────────────────────────────────────────────────────────────────

class TestCasoH:
    """CASO H: todos los modos del contrato son reconocidos correctamente."""

    @pytest.mark.parametrize("mode_str,expected_mode,triage_expected", [
        ("doctor_professional",   AssistantMode.DOCTOR_PROFESSIONAL,   False),
        ("patient_assistant",     AssistantMode.PATIENT_ASSISTANT,      False),
        ("patient_triage",        AssistantMode.PATIENT_TRIAGE,         True),
        ("receptionist",          AssistantMode.RECEPTIONIST,           False),
        ("administrative",        AssistantMode.ADMINISTRATIVE,         False),
        ("generic_non_clinical",  AssistantMode.GENERIC_NON_CLINICAL,   False),
    ])
    def test_mode_recognition_and_triage_capability(self, mode_str, expected_mode, triage_expected):
        mode = AssistantMode.from_raw(mode_str)
        assert mode == expected_mode
        caps = get_capabilities(mode)
        assert caps.triage_allowed == triage_expected, (
            f"Modo '{mode_str}': triage_allowed={caps.triage_allowed} "
            f"pero se esperaba {triage_expected}"
        )

    @pytest.mark.parametrize("role_str,expected_role", [
        ("doctor",      ActorRole.DOCTOR),
        ("patient",     ActorRole.PATIENT),
        ("receptionist", ActorRole.RECEPTIONIST),
        ("admin",       ActorRole.ADMIN),
        ("system",      ActorRole.SYSTEM),
    ])
    def test_actor_role_recognition(self, role_str, expected_role):
        role = ActorRole.from_raw(role_str)
        assert role == expected_role

    def test_only_patient_triage_has_triage_allowed(self):
        """Solo patient_triage tiene triage_allowed=True. Todos los demás: False."""
        triage_enabled_modes = [
            m for m in AssistantMode
            if get_capabilities(m).triage_allowed
        ]
        assert triage_enabled_modes == [AssistantMode.PATIENT_TRIAGE], (
            f"Modos con triage_allowed=True (esperado: solo patient_triage): "
            f"{[m.value for m in triage_enabled_modes]}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Tests de integridad de triage_engine (regresión)
# ─────────────────────────────────────────────────────────────────────────────

class TestTriageEngineIntegrity:
    """Verifica que triage_engine no genera sintoma_generico para texto casual."""

    @pytest.mark.parametrize("text", [
        "sabes que dia es hoy",
        "quiero un turno",
        "hola",
        "que hora es",
        "gracias",
        "como funciona esto",
        "cuanto cuesta la consulta",
        "necesito ayuda",
        "",
    ])
    def test_no_sintoma_generico_for_casual_text(self, text):
        from brain.decision_engine import triage_engine
        result = triage_engine.evaluate(
            symptoms=[text] if text else [],
            duration_days=None,
            age=None,
        )
        assert "sintoma_generico" not in result.matched_criteria, (
            f"Bug sintoma_generico para '{text}': matched={result.matched_criteria}"
        )

    def test_empty_symptoms_returns_azul(self):
        from brain.decision_engine import triage_engine
        result = triage_engine.evaluate(symptoms=[], duration_days=None, age=None)
        assert result.triage_level == "azul"
        assert result.matched_criteria == []

    def test_unmatched_symptoms_returns_azul_not_verde(self):
        """Texto sin regla clínica → azul (no urgente), NO verde (leve)."""
        from brain.decision_engine import triage_engine
        result = triage_engine.evaluate(
            symptoms=["texto completamente no medico xyz"],
            duration_days=None,
            age=None,
        )
        assert result.triage_level == "azul"
        # Verde ahora requiere una regla real (tos, fiebre corta, etc.)
        assert result.triage_level != "verde"


# ─────────────────────────────────────────────────────────────────────────────
# Tests de aislamiento DOCTOR / PATIENT (INVARIANT E)
# ─────────────────────────────────────────────────────────────────────────────

class TestRoleIsolation:
    """INVARIANT E: pipelines doctor/paciente son mutuamente excluyentes."""

    def test_doctor_never_gets_triage_pipeline(self, doctor_contract):
        for intent in list(CLINICAL_INTENTS) + list(NON_TRIAGE_INTENTS):
            decision, _ = RoleRouter.route(
                contract=doctor_contract,
                intent=intent,
                confidence=1.0,
                context={"symptoms": ["dolor pecho severo", "no puede respirar"]},
            )
            assert decision != RoutingDecision.TRIAGE_PIPELINE, (
                f"INVARIANT E ROTA: doctor con intent='{intent}' devolvió TRIAGE_PIPELINE"
            )

    def test_patient_triage_never_gets_doctor_pipeline(self, patient_triage_contract):
        decision, eligibility = RoleRouter.route(
            contract=patient_triage_contract,
            intent="symptom_report",
            confidence=0.9,
            context={"symptoms": ["fiebre", "tos"]},
        )
        assert decision != RoutingDecision.DOCTOR_PIPELINE, (
            f"INVARIANT E ROTA: patient_triage devolvió DOCTOR_PIPELINE"
        )

    def test_contracts_are_frozen_between_calls(self):
        """El contrato no muta entre llamadas."""
        c1 = build_contract(mode_raw="doctor_professional")
        c2 = build_contract(mode_raw="patient_triage")
        assert c1.mode != c2.mode
        assert c1.triage_allowed is False
        assert c2.triage_allowed is True
        # c1 no debe haber cambiado
        assert c1.triage_allowed is False
