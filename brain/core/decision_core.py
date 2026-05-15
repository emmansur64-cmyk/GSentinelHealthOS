"""Módulo central de decisión clínica — GSentinelH.

Unifica la lógica de intent detection, evaluación de triage y generación de
respuesta en un único pipeline reutilizable.

Usado por:
  - BrainOrchestrator  (brain/services/orchestrator.py) — worker WhatsApp/Redis
  - IntelligentOrchestrator (brain/orchestration/orchestrator.py) — HTTP /orchestrate

Pipeline:
    process_input(user_input, context)
        ↓
    detect_intent   → NLUEngine.analyze() + run_dialogue()
        ↓
    evaluate_triage → triage_engine.evaluate() + run_inference() + run_decision()
        ↓
    generate_response → LinguisticEngine.generate() / mensaje clínico específico

Garantía: 100% offline, sin llamadas HTTP externas.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import logging
from typing import Any, Dict, List, Optional

from brain.contracts.routing import (
    AssistantMode,
    ConversationalContract,
    NON_TRIAGE_INTENTS,
    SAFE_FALLBACK_RESPONSE,
    build_contract,
)
from brain.core.clinical_detector import is_clinical_case
from brain.core.clinical_parser import parse_case
from brain.decision_engine import triage_engine
from brain.decision_engine.local_engine import run_decision, run_dialogue, run_inference
from brain.routing.triage_eligibility import TriageEligibilityValidator
from MetaBrain.nlu_engine import NLUEngine

logger = logging.getLogger(__name__)

# ── Instancia compartida del motor lingüístico ─────────────────────────────────
# LinguisticEngine se importa en diferido para evitar importación circular con
# brain.orchestration (cuyo __init__ importa orchestrator → decision_core → LinguisticEngine).
_linguistic_engine: "Any | None" = None


def _get_linguistic_engine() -> "Any":
    global _linguistic_engine
    if _linguistic_engine is None:
        from brain.orchestration.linguistic_engine import LinguisticEngine  # noqa: PLC0415
        _linguistic_engine = LinguisticEngine()
    return _linguistic_engine

# ── Intents que nunca requieren inferencia ML ──────────────────────────────────
_INTENTS_NO_INFERENCE: frozenset[str] = frozenset(
    {
        "greeting",
        "farewell",
        "help",
        "unknown",
        "small_talk",
        "booking",
        "cancel_booking",
        "book_appointment",
        "cancel_appointment",
        "check_availability",
        "general_query",
        "SYSTEM_RESET",
    }
)

# ── Fallback de triage para casos sin clasificación ───────────────────────────
_FALLBACK_TRIAGE: Dict[str, Any] = {
    "risk_level": "unknown",
    "triage_level": "unknown",
    "flags": [],
    "recommendations": [],
    "action_required": False,
    "_raw_triage": None,
    "_fallback": True,
}

# ── Umbral de confianza por defecto ────────────────────────────────────────────
DEFAULT_CONFIDENCE_THRESHOLD: float = 0.60


@dataclass
class ClinicalInput:
    """Entrada estructurada para el análisis clínico directo."""

    symptoms: List[str] = field(default_factory=list)
    age: int | None = None
    duration_hours: float | None = None
    chronic_conditions: List[str] = field(default_factory=list)
    pain_scale: int | None = None


# ── detect_intent ──────────────────────────────────────────────────────────────

async def detect_intent(
    user_input: str,
    context: Dict[str, Any],
    *,
    nlu_result: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Detecta la intención del usuario.

    Si se provee ``nlu_result`` (ya calculado por el caller), reutiliza ese
    resultado en lugar de volver a llamar a NLUEngine. Esto permite que
    BrainOrchestrator pase el resultado de ``analyze_with_learning`` sin
    duplicar el análisis.

    Returns:
        Contrato de dialogue-engine:
        { intent, entities, next_step, requires_inference, context, confidence }
    """
    if nlu_result is None:
        history = context.get("history")
        nlu_result = await NLUEngine.analyze(user_input, history=history)

    return run_dialogue(user_input, context, nlu_result)


# ── evaluate_triage ────────────────────────────────────────────────────────────

def evaluate_triage(
    user_input: str,
    context: Dict[str, Any],
    explicit_symptoms: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Evalúa el nivel de triage clínico.

    SEGURIDAD: Solo llama cuando el TriageEligibilityValidator confirmó elegibilidad.
    Los síntomas se extraen del contexto estructurado (explicit_symptoms) o del
    campo 'symptoms' del contexto. NUNCA se usa user_input como síntoma.

    Args:
        user_input:         Texto del usuario (NO usado como síntoma).
        context:            Contexto de sesión con síntomas estructurados.
        explicit_symptoms:  Síntomas ya validados por TriageEligibilityValidator.

    Returns:
        Contrato de decision-service enriquecido:
        { risk_level, triage_level, flags, recommendations, action_required,
          _raw_triage: TriageResult }
    """
    # SEGURIDAD: usar solo síntomas explícitos validados.
    # NUNCA user_input como síntoma (elimina el bug original).
    if explicit_symptoms is not None:
        symptoms = explicit_symptoms
    else:
        raw_symptoms = context.get("symptoms")
        if isinstance(raw_symptoms, list) and raw_symptoms:
            symptoms = [str(s) for s in raw_symptoms if s]
        elif isinstance(raw_symptoms, str) and raw_symptoms.strip():
            symptoms = [raw_symptoms.strip()]
        else:
            # Sin síntomas explícitos → no hay triage real posible
            symptoms = []

    if not symptoms:
        logger.debug("evaluate_triage: sin síntomas explícitos → fallback vacío")
        return dict(_FALLBACK_TRIAGE)

    age: Optional[int] = context.get("age") if isinstance(context.get("age"), int) else None
    chronic: List[str] = context.get("chronic_conditions", []) or []
    duration: Optional[float] = context.get("duration_days")

    patient_data: Dict[str, Any] = {
        "age": age,
        "chronic_conditions": chronic,
        "duration_days": duration,
    }

    raw_triage = triage_engine.evaluate(
        symptoms=symptoms,
        duration_days=duration,
        age=age,
        chronic_conditions=chronic,
    )

    inference_out = run_inference(symptoms, patient_data)
    decision_out = run_decision(inference_out, patient_data, context)

    return {**decision_out, "_raw_triage": raw_triage}


# ── _build_clinical_triage_message ─────────────────────────────────────────────

def _build_clinical_triage_message(result: triage_engine.TriageResult) -> str:
    """Genera mensaje de triage clínico específico según nivel MTS.

    Misma lógica que BrainOrchestrator._handle_clinical_query, centralizada aquí.
    """
    level = result.triage_level
    action = result.recommended_action

    if level == "rojo":
        return (
            "ALERTA: Los sintomas que describes requieren atencion de emergencia inmediata.\n"
            f"{action}\n"
            "Por favor llama al 911 o diríjete a urgencias ahora."
        )
    if level == "naranja":
        criteria = ", ".join(result.matched_criteria[:3])
        return (
            f"Tus sintomas son urgentes (nivel: {level.upper()}).\n"
            f"{action}\n"
            f"Criterios detectados: {criteria}."
        )
    if level == "amarillo":
        return (
            f"Tus sintomas requieren atencion medica pronto (nivel: {level.upper()}).\n"
            f"{action}\n"
            "Si los sintomas empeoran, acude a urgencias.\n"
            "Puedo ayudarte a agendar una cita. Escribe: 'Quiero un turno con medico general'."
        )
    # verde / azul / unknown
    return (
        f"Tus sintomas son de baja urgencia (nivel: {level.upper()}).\n"
        f"{action}\n"
        "Puedo ayudarte a agendar una cita. Escribe: 'Quiero un turno con medico general'."
    )


# ── generate_response ──────────────────────────────────────────────────────────

def generate_response(
    intent: str,
    triage: Dict[str, Any],
    context: Dict[str, Any],
) -> str:
    """Genera la respuesta en lenguaje natural.

    Si el triage tiene criterios clínicos activos (matched_criteria), usa
    mensajes específicos de urgencia MTS.  De lo contrario delega en
    LinguisticEngine para respuestas conversacionales/rule-based.

    Args:
        intent:  Intent detectado por NLU.
        triage:  Resultado de evaluate_triage() o fallback.
        context: Contexto enriquecido, puede incluir "session_state".

    Returns:
        Texto de respuesta listo para enviar al usuario.
    """
    raw_triage: Optional[triage_engine.TriageResult] = triage.get("_raw_triage")

    # Triage clínico activo → mensaje de urgencia estructurado
    if raw_triage is not None and getattr(raw_triage, "matched_criteria", None):
        return _build_clinical_triage_message(raw_triage)

    # Respuesta conversacional vía LinguisticEngine
    session_state: Dict[str, Any] = context.get("session_state") or {}
    return _get_linguistic_engine().generate(intent, triage, context, session_state)


def _normalize_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _normalize_float(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _expand_structured_symptoms(parsed_case: Dict[str, Any]) -> List[str]:
    """Traduce síntomas estructurados a frases compatibles con triage_engine."""
    symptom_map: Dict[str, str] = {
        "muscle_pain": "dolor muscular",
        "myoglobinuria": "orina oscura",
        "weakness": "debilidad",
    }

    expanded: List[str] = []
    for symptom_code in parsed_case.get("symptoms", []):
        expanded.append(symptom_map.get(symptom_code, str(symptom_code)))
    return expanded


def _expand_structured_findings(parsed_case: Dict[str, Any]) -> List[str]:
    """Convierte laboratorio/contexto estructurado en hallazgos clínicos textuales."""
    findings: List[str] = []

    ck = parsed_case.get("ck")
    if isinstance(ck, (int, float)):
        findings.append(f"ck {ck}")
        if ck >= 5000:
            findings.append("ck muy elevada")

    creatinine = parsed_case.get("creatinine")
    if isinstance(creatinine, (int, float)):
        findings.append(f"creatinina {creatinine}")
        if creatinine >= 1.5:
            findings.append("creatinina elevada")

    potassium = parsed_case.get("potassium")
    if isinstance(potassium, (int, float)):
        findings.append(f"potasio {potassium}")
        if potassium >= 5.5:
            findings.append("hiperpotasemia")

    if parsed_case.get("trigger") == "exertion":
        findings.append("ejercicio intenso")

    return findings


def _build_clinical_input(parsed_case: Dict[str, Any], context: Dict[str, Any]) -> ClinicalInput:
    """Construye la entrada clínica estructurada con defaults seguros."""
    age = _normalize_int(context.get("age"), 32)
    duration_hours = _normalize_float(context.get("duration_hours"), 48.0)

    if "duration_days" in context and context.get("duration_days") is not None:
        duration_hours = _normalize_float(context.get("duration_days"), 2.0) * 24.0

    pain_scale = _normalize_int(context.get("pain_scale"), 8)
    chronic_conditions = context.get("chronic_conditions") or []
    if not isinstance(chronic_conditions, list):
        chronic_conditions = []

    return ClinicalInput(
        symptoms=parsed_case.get("symptoms", []),
        age=age,
        duration_hours=duration_hours,
        chronic_conditions=[str(item) for item in chronic_conditions if item],
        pain_scale=pain_scale,
    )


def _evaluate_clinical_input(
    clinical_input: ClinicalInput,
    parsed_case: Dict[str, Any],
    user_input: str,
) -> triage_engine.TriageResult:
    """Ejecuta evaluación clínica directa usando la entrada estructurada."""
    symptom_texts = _expand_structured_symptoms(parsed_case)
    symptom_texts.extend(_expand_structured_findings(parsed_case))
    if user_input.strip():
        symptom_texts.append(user_input)

    if not symptom_texts:
        symptom_texts = clinical_input.symptoms

    return triage_engine.evaluate(
        symptoms=symptom_texts,
        age=clinical_input.age,
        duration_days=(
            clinical_input.duration_hours / 24.0
            if clinical_input.duration_hours is not None
            else None
        ),
        chronic_conditions=clinical_input.chronic_conditions,
    )


def generate_clinical_summary(
    parsed_case: Dict[str, Any],
    decision: triage_engine.TriageResult,
) -> str:
    """Genera un análisis clínico directo a partir del caso parseado."""
    symptoms = parsed_case.get("symptoms", [])
    diagnosis = "cuadro muscular agudo"
    if "myoglobinuria" in symptoms:
        diagnosis = "rabdomiolisis"

    critical_findings: List[str] = []
    if parsed_case.get("ck") is not None:
        critical_findings.append("* Elevacion masiva de CK")
    if parsed_case.get("creatinine") is not None:
        critical_findings.append("* Insuficiencia renal aguda")
    if "myoglobinuria" in symptoms:
        critical_findings.append("* Mioglobinuria")

    required_actions = [
        "* hidratacion agresiva",
        "* monitoreo electrolitico",
    ]

    findings_block = "\n".join(critical_findings) if critical_findings else "* Sin hallazgos criticos estructurados"
    actions_block = "\n".join(required_actions)

    return (
        f"El cuadro es compatible con {diagnosis} inducida por esfuerzo.\n\n"
        "Hallazgos criticos:\n\n"
        f"{findings_block}\n\n"
        f"Riesgo: {decision.triage_level}\n\n"
        "Requiere:\n\n"
        f"{actions_block}"
    )


def _merge_clinical_case_context(
    user_input: str,
    context: Dict[str, Any],
    parsed_case: Dict[str, Any],
) -> Dict[str, Any]:
    """Enriquece el contexto con la estructura parseada del caso clínico."""
    base_symptoms = context.get("symptoms") or []
    if isinstance(base_symptoms, str):
        symptom_candidates: List[str] = [base_symptoms]
    elif isinstance(base_symptoms, list):
        symptom_candidates = [str(item) for item in base_symptoms if item]
    else:
        symptom_candidates = []

    symptom_candidates.append(user_input)
    symptom_candidates.extend(parsed_case.get("symptoms", []))

    symptoms: List[str] = []
    seen: set[str] = set()
    for symptom in symptom_candidates:
        normalized = str(symptom).strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        symptoms.append(normalized)

    existing_patient_data = context.get("patient_data")
    if not isinstance(existing_patient_data, dict):
        existing_patient_data = {}

    return {
        **context,
        "symptoms": symptoms,
        "clinical_case": parsed_case,
        "patient_data": {
            **existing_patient_data,
            **parsed_case,
        },
    }


async def process_clinical_case(
    user_input: str,
    context: Dict[str, Any],
) -> Dict[str, Any]:
    """Procesa directamente un caso clínico estructurado."""
    parsed_case = parse_case(user_input)
    clinical_input = _build_clinical_input(parsed_case, context)
    enriched_context = _merge_clinical_case_context(user_input, context, parsed_case)
    enriched_context["clinical_input"] = {
        "symptoms": clinical_input.symptoms,
        "age": clinical_input.age,
        "duration_hours": clinical_input.duration_hours,
        "chronic_conditions": clinical_input.chronic_conditions,
        "pain_scale": clinical_input.pain_scale,
    }

    try:
        decision = _evaluate_clinical_input(clinical_input, parsed_case, user_input)
    except Exception as exc:
        logger.error("decision_core.process_clinical_case falló en análisis clínico: %s", exc)
        decision = triage_engine.TriageResult(
            triage_level="unknown",
            risk_score=0.0,
            recommended_action="Se requiere más información clínica para evaluar el caso.",
            flags=[],
            matched_criteria=[],
        )

    triage = {
        "risk_level": (
            "alto" if decision.triage_level in {"rojo", "naranja"}
            else "medio" if decision.triage_level == "amarillo"
            else "bajo" if decision.triage_level in {"verde", "azul"}
            else "unknown"
        ),
        "triage_level": decision.triage_level,
        "flags": list(decision.flags),
        "recommendations": [decision.recommended_action],
        "action_required": decision.triage_level in {"rojo", "naranja"},
        "_raw_triage": decision,
        "_fallback": decision.triage_level == "unknown",
    }
    analysis = generate_clinical_summary(parsed_case, decision)

    return {
        "type": "clinical_analysis",
        "intent": "clinical_case",
        "confidence": 1.0,
        "requires_inference": True,
        "triage": triage,
        "triage_level": decision.triage_level,
        "risk": decision.risk_score,
        "flags": list(decision.flags),
        "analysis": analysis,
        "response": analysis,
        "dialogue": {
            "intent": "clinical_case",
            "confidence": 1.0,
            "requires_inference": True,
            "context": enriched_context,
            "next_step": "respond",
            "explanation_count": 0,
        },
    }


# ── process_input — punto de entrada unificado ────────────────────────────────

async def process_input(
    user_input: str,
    context: Dict[str, Any],
    *,
    confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
    nlu_result: Optional[Dict[str, Any]] = None,
    contract: Optional["ConversationalContract"] = None,
) -> Dict[str, Any]:
    """Pipeline unificado de decisión clínica con role isolation.

    Args:
        user_input:           Texto del usuario.
        context:              Contexto de sesión/conversación.
        confidence_threshold: Umbral mínimo de confianza para inferencia ML.
        nlu_result:           Resultado NLU pre-calculado (opcional).
        contract:             ConversationalContract con mode, capabilities y role.
                              Si no se provee, se construye uno desde el contexto.
                              Si el contexto tampoco lo tiene → GENERIC_NON_CLINICAL.

    Returns:
        {
            "intent":             str,
            "confidence":         float,
            "requires_inference": bool,
            "triage":             dict  (contrato decision-service + _raw_triage),
            "response":           str,
            "dialogue":           dict  (contrato dialogue-engine completo),
            "_routing_trace":     dict  (audit trail del routing),
        }
    """
    # ── Resolver contrato conversacional ──────────────────────────────────────
    if contract is None:
        contract = build_contract(
            mode_raw=context.get("_contract_mode"),
            actor_role_raw=context.get("_contract_actor_role"),
            doctor_id=context.get("doctor_id") or context.get("_doctor_id"),
            patient_id=context.get("patient_id") or context.get("_patient_id"),
            request_id=context.get("request_id") or context.get("_request_id"),
        )

    logger.debug(
        "decision_core.process_input: mode=%s triage_allowed=%s",
        contract.mode.value, contract.triage_allowed,
    )

    # ── Casos clínicos estructurados: solo para modos con clinical_reasoning ──
    if is_clinical_case(user_input) and contract.capabilities.clinical_reasoning_allowed:
        result = await process_clinical_case(user_input, context)
        result["_routing_trace"] = {
            "path": "clinical_case_structured",
            "mode": contract.mode.value,
            "triage_allowed": contract.triage_allowed,
        }
        return result

    # ── Paso 1: Intent detection ───────────────────────────────────────────────
    try:
        dialogue_output = await detect_intent(user_input, context, nlu_result=nlu_result)
    except Exception as exc:
        logger.error("decision_core.detect_intent falló: %s", exc)
        dialogue_output = {
            "intent": "unknown",
            "confidence": 0.5,
            "requires_inference": False,
            "context": context,
            "next_step": "respond",
            "explanation_count": 0,
        }

    intent: str = dialogue_output.get("intent", "unknown")
    confidence: float = float(dialogue_output.get("confidence", 0.5))
    requires_inference: bool = bool(dialogue_output.get("requires_inference", False))

    # Enriquecer contexto con entidades extraídas por el dialogue-engine
    enriched_context: Dict[str, Any] = {**context, **dialogue_output.get("context", {})}

    # Inyectar contrato en el contexto enriquecido para propagación downstream
    enriched_context.update(contract.to_context_dict())

    triage: Dict[str, Any] = dict(_FALLBACK_TRIAGE)
    routing_trace: Dict[str, Any] = {
        "mode": contract.mode.value,
        "intent": intent,
        "confidence": confidence,
        "triage_allowed_by_contract": contract.triage_allowed,
    }

    # ── Paso 2: TRIAGE GATE — con role isolation ───────────────────────────────
    #
    # INVARIANT A: DOCTOR_PROFESSIONAL → NUNCA triage automático.
    # INVARIANT B: NON_TRIAGE_INTENTS (general_query, etc.) → NUNCA triage.
    # INVARIANT C: Solo TRIAGE_ELIGIBLE pasa al motor de triage.
    #
    triage_ran = False

    if not contract.triage_allowed:
        # Contrato bloquea triage: respuesta conversacional directa
        routing_trace["triage_gate"] = "BLOCKED_BY_CONTRACT"
        routing_trace["triage_gate_reason"] = f"mode={contract.mode.value}"
        triage = dict(_FALLBACK_TRIAGE)

    elif intent in NON_TRIAGE_INTENTS:
        # INVARIANT B: intent no clínico → sin triage
        routing_trace["triage_gate"] = "BLOCKED_BY_INTENT"
        routing_trace["triage_gate_reason"] = f"non_triage_intent={intent}"
        triage = dict(_FALLBACK_TRIAGE)

    elif requires_inference and confidence < confidence_threshold and intent not in _INTENTS_NO_INFERENCE:
        # Confianza insuficiente → pedir aclaración sin ejecutar triage
        triage = dict(_FALLBACK_TRIAGE, flags=["needs_clarification"])
        routing_trace["triage_gate"] = "BLOCKED_LOW_CONFIDENCE"
        routing_trace["triage_gate_reason"] = f"confidence={confidence:.2f}<{confidence_threshold}"

    else:
        # Validar elegibilidad completa
        from brain.routing.triage_eligibility import TriageEligibilityValidator
        eligibility = TriageEligibilityValidator.validate(
            contract=contract,
            intent=intent,
            confidence=confidence,
            context=enriched_context,
        )
        routing_trace["triage_eligibility"] = eligibility.to_trace()

        if eligibility.is_triage_eligible:
            try:
                triage = evaluate_triage(
                    user_input,
                    enriched_context,
                    explicit_symptoms=eligibility.explicit_symptoms,
                )
                triage_ran = True
                routing_trace["triage_gate"] = "EXECUTED"
            except Exception as exc:
                logger.error("decision_core.evaluate_triage falló: %s", exc)
                triage = dict(_FALLBACK_TRIAGE)
                routing_trace["triage_gate"] = "ERROR"
        else:
            routing_trace["triage_gate"] = f"NOT_ELIGIBLE:{eligibility.state.value}"
            triage = dict(_FALLBACK_TRIAGE)

    routing_trace["triage_executed"] = triage_ran

    # ── Paso 3: Response generation ────────────────────────────────────────────
    if not triage_ran and intent in NON_TRIAGE_INTENTS:
        # Para intents claramente no clínicos: usar "needs_clarification" como
        # señal al LinguisticEngine para respuesta conversacional limpia
        response = generate_response(intent, dict(_FALLBACK_TRIAGE), enriched_context)
    else:
        response = generate_response(intent, triage, enriched_context)

    return {
        "intent": intent,
        "confidence": confidence,
        "requires_inference": requires_inference,
        "triage": triage,
        "response": response,
        "dialogue": dialogue_output,
        "_routing_trace": routing_trace,
    }
