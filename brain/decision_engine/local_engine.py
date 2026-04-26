"""Adaptadores locales para los servicios de IA del IntelligentOrchestrator.

Delega la logica de triage en triage_engine.evaluate(), que implementa
el Sistema de Triage de Manchester simplificado.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

from brain.decision_engine import triage_engine

logger = logging.getLogger(__name__)

# Mapa de nivel MTS -> risk_level semantico
_RISK_MAP: Dict[str, str] = {
    "rojo":     "alto",
    "naranja":  "alto",
    "amarillo": "medio",
    "verde":    "bajo",
    "azul":     "bajo",
    "unknown":  "unknown",
}


def _normalize(text: str) -> str:
    import unicodedata
    nfkd = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def _extract_symptoms_from_context(context: Dict[str, Any]) -> List[str]:
    """Extrae lista de sintomas desde el contexto del dialogo."""
    symptoms = context.get("symptoms", [])
    if isinstance(symptoms, list):
        return [str(s) for s in symptoms if s]
    if isinstance(symptoms, str) and symptoms:
        return [symptoms]
    return []


# -- API publica ---------------------------------------------------------------

def run_inference(
    symptoms: List[str],
    patient_data: Dict[str, Any],
) -> Dict[str, Any]:
    """Inferencia local usando triage_engine.

    Retorna el contrato de inference-service:
      { predictions, confidence_scores, raw_output }
    """
    age: int | None = patient_data.get("age") if isinstance(patient_data, dict) else None
    chronic: List[str] = (
        patient_data.get("chronic_conditions", []) if isinstance(patient_data, dict) else []
    )
    duration: float | None = (
        patient_data.get("duration_days") if isinstance(patient_data, dict) else None
    )

    result = triage_engine.evaluate(
        symptoms=symptoms,
        duration_days=duration,
        age=age,
        chronic_conditions=chronic,
    )

    triage = result.triage_level
    confidence = result.risk_score
    risk = _RISK_MAP.get(triage, "unknown")

    predictions = [
        {
            "label": triage,
            "probability": confidence,
            "risk_level": risk,
        }
    ]
    if result.matched_criteria:
        predictions.append({
            "label": "matched_criteria",
            "probability": confidence,
            "matched": result.matched_criteria,
        })

    return {
        "predictions": predictions,
        "confidence_scores": {triage: confidence},
        "raw_output": {
            "source": "triage_engine",
            "triage_level": triage,
            "risk_level": risk,
            "matched_criteria": result.matched_criteria,
            "flags": result.flags,
            "recommended_action": result.recommended_action,
            "symptoms_analyzed": len(symptoms),
        },
        "_fallback": False,
    }


def run_decision(
    inference_output: Dict[str, Any],
    patient_data: Dict[str, Any],
    context: Dict[str, Any],
) -> Dict[str, Any]:
    """Motor de decision local -- usa la salida de run_inference.

    Retorna el contrato de decision-service:
      { risk_level, triage_level, flags, recommendations, action_required }
    """
    raw = inference_output.get("raw_output", {})
    risk_level: str = raw.get("risk_level", "unknown")
    triage_level: str = raw.get("triage_level", "unknown")
    flags: List[str] = list(raw.get("flags", []))
    recommended_action: str = raw.get("recommended_action", "")
    matched: List[str] = raw.get("matched_criteria", [])
    predictions = inference_output.get("predictions", [])

    # Escalar flags desde predicciones de alta urgencia
    for pred in predictions:
        if isinstance(pred, dict) and pred.get("label") in {"rojo", "naranja"}:
            if "urgent_referral" not in flags:
                flags.append("urgent_referral")

    action_required = triage_level in {"rojo", "naranja"}

    recommendations: List[str] = []
    if recommended_action:
        recommendations.append(recommended_action)

    if triage_level == "rojo" and "possible_emergency" not in flags:
        flags.append("possible_emergency")

    if matched and triage_level in {"amarillo", "verde"}:
        recommendations.append(f"Criterios detectados: {', '.join(matched[:3])}.")

    if not recommendations:
        recommendations.append("Se requiere mas informacion para una evaluacion precisa.")

    return {
        "risk_level": risk_level,
        "triage_level": triage_level,
        "flags": flags,
        "recommendations": recommendations,
        "action_required": action_required,
        "_fallback": False,
    }


def run_dialogue(
    user_input: str,
    context: Dict[str, Any],
    nlu_result: Dict[str, Any],
) -> Dict[str, Any]:
    """Construye la salida del dialogue-engine a partir del resultado NLU.

    Retorna el contrato de dialogue-engine:
      { intent, entities, next_step, requires_inference, context, confidence }
    """
    intent: str = nlu_result.get("intent", "unknown")
    entities: Dict[str, Any] = nlu_result.get("entities", {})
    confidence: float = float(nlu_result.get("confidence", 0.5))

    _NO_INFERENCE = {
        "greeting", "farewell", "help", "unknown", "small_talk",
        "booking", "cancel_booking", "book_appointment",
        "cancel_appointment", "check_availability", "general_query",
        "SYSTEM_RESET",
    }

    requires_inference = intent not in _NO_INFERENCE

    if intent in {"book_appointment", "check_availability"}:
        next_step = "respond"
    elif requires_inference:
        next_step = "analyze"
    else:
        next_step = "respond"

    symptoms = _extract_symptoms_from_context(entities)
    if not symptoms:
        # Deteccion basica de sintomas en el texto via triage_engine normalize
        normalized_input = _normalize(user_input)
        # Pasar el texto como unico sintoma para que triage_engine lo procese
        probe = triage_engine.evaluate(symptoms=[user_input])
        if probe.matched_criteria:
            symptoms = [user_input]

    enriched_context = {
        **context,
        "symptoms": symptoms,
        "patient_data": entities.get("patient_data", {}),
        "specialty": entities.get("specialty"),
        "entities": entities,
    }

    return {
        "intent": intent,
        "entities": entities,
        "next_step": next_step,
        "requires_inference": requires_inference,
        "context": enriched_context,
        "confidence": confidence,
        "explanation_count": 0,
        "_source": "local_dialogue_engine",
    }