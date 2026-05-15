from __future__ import annotations

from typing import Any

from cerebro_ai_med.decision.decision_engine import DecisionEngine
from metabrain.pipeline import GroqLanguagePipeline


_RISK_ORDER = {
    "unknown": 0,
    "low": 1,
    "medium": 2,
    "high": 3,
}

_RISK_NORMALIZATION = {
    "bajo": "low",
    "medio": "medium",
    "alto": "high",
    "low": "low",
    "medium": "medium",
    "high": "high",
}


class HybridDecisionOrchestrator:
    """Combine deterministic cerebro rules with Groq reasoning for robust joint decisions."""

    def __init__(
        self,
        *,
        decision_engine: DecisionEngine | None = None,
        groq_pipeline: GroqLanguagePipeline | None = None,
    ) -> None:
        self._decision_engine = decision_engine or DecisionEngine()
        self._groq_pipeline = groq_pipeline or GroqLanguagePipeline()

    def decide(
        self,
        *,
        model_output: dict[str, Any],
        modality: str,
        input_text: str | None,
        patient_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        patient_context = patient_context or {}

        cerebro = self._decision_engine.interpret(model_output=model_output, patient_context=patient_context)
        groq = self._run_groq_reasoning(
            input_text=input_text,
            modality=modality,
            model_output=model_output,
            patient_context=patient_context,
        )

        cerebro_risk = self._normalize_risk(cerebro.get("risk_level"))
        groq_risk = self._normalize_risk(groq.get("risk_level"))
        final_risk = self._max_risk(cerebro_risk, groq_risk)

        deferred = bool(cerebro.get("deferred", False))
        if deferred:
            consensus = "cerebro_primary"
            final_action_plan = str(cerebro.get("action_plan", "mandatory_manual_clinical_review"))
            final_urgency = str(cerebro.get("urgency", "deferred"))
            follow_up_hours = int(cerebro.get("follow_up_hours", 0) or 0)
        elif _RISK_ORDER[groq_risk] > _RISK_ORDER[cerebro_risk]:
            consensus = "escalated_by_groq"
            final_action_plan = "mandatory_manual_clinical_review"
            final_urgency = "immediate" if groq_risk == "high" else "priority"
            follow_up_hours = 0 if groq_risk == "high" else 4
        else:
            consensus = "aligned" if groq_risk == cerebro_risk else "cerebro_primary"
            final_action_plan = str(cerebro.get("action_plan", "clinical_followup"))
            final_urgency = str(cerebro.get("urgency", "priority"))
            follow_up_hours = int(cerebro.get("follow_up_hours", 24) or 24)

        return {
            "final_risk_level": final_risk,
            "consensus": consensus,
            "final_action_plan": final_action_plan,
            "final_urgency": final_urgency,
            "follow_up_hours": follow_up_hours,
            "sources": ["cerebro_rules", "groq_pipeline"],
            "source_count": 2,
            "cerebro": {
                "risk_level": cerebro_risk,
                "urgency": str(cerebro.get("urgency", "priority")),
                "action_plan": str(cerebro.get("action_plan", "clinical_followup")),
                "deferred": bool(cerebro.get("deferred", False)),
                "decision_score": float(cerebro.get("decision_score", 0.0) or 0.0),
            },
            "groq": {
                "enabled": bool(groq.get("enabled", False)),
                "risk_level": groq_risk,
                "narrative": str(groq.get("narrative", "")),
                "fallback_applied": bool(groq.get("fallback_applied", False)),
                "stages_executed": list(groq.get("stages_executed", [])),
            },
            "details": {
                "cerebro_decision": cerebro,
                "groq_orchestration": groq.get("orchestration", {}),
                "groq_guardrail": groq.get("guardrail"),
            },
        }

    def _run_groq_reasoning(
        self,
        *,
        input_text: str | None,
        modality: str,
        model_output: dict[str, Any],
        patient_context: dict[str, Any],
    ) -> dict[str, Any]:
        case_text = self._build_case_text(
            input_text=input_text,
            modality=modality,
            model_output=model_output,
            patient_context=patient_context,
        )

        try:
            result = self._groq_pipeline.process(case_text, context=patient_context)
            risk = self._extract_groq_risk(result.orchestration, result.guardrail)
            return {
                "enabled": True,
                "risk_level": risk,
                "narrative": result.text,
                "fallback_applied": result.fallback_applied,
                "stages_executed": result.stages_executed,
                "orchestration": result.orchestration,
                "guardrail": result.guardrail,
            }
        except Exception as exc:
            return {
                "enabled": False,
                "risk_level": "unknown",
                "narrative": (
                    "No fue posible obtener razonamiento de Groq en este momento. "
                    "Se mantiene la decision del cerebro de reglas."
                ),
                "fallback_applied": True,
                "stages_executed": ["groq_error_fallback"],
                "orchestration": {"error": str(exc)},
                "guardrail": None,
            }

    def _build_case_text(
        self,
        *,
        input_text: str | None,
        modality: str,
        model_output: dict[str, Any],
        patient_context: dict[str, Any],
    ) -> str:
        if input_text:
            return input_text

        probs = model_output.get("probabilities") or {}
        probs_text = ", ".join(
            f"{label}:{float(value):.4f}"
            for label, value in probs.items()
            if label in {"low", "medium", "high"}
        )
        if not probs_text:
            probs_text = "low:0.0000, medium:0.0000, high:0.0000"

        symptoms = patient_context.get("symptoms") or []
        symptom_text = ", ".join(str(item) for item in symptoms) if symptoms else "none"

        return (
            "Clinical case summary for joint decision. "
            f"modality={modality}; "
            f"finding_code={model_output.get('finding_code', 'unknown')}; "
            f"model_risk={model_output.get('risk_level', 'unknown')}; "
            f"model_confidence={float(model_output.get('confidence', 0.0)):.4f}; "
            f"probabilities={probs_text}; "
            f"symptoms={symptom_text}."
        )

    def _extract_groq_risk(
        self,
        orchestration: dict[str, object],
        guardrail: dict[str, object] | None,
    ) -> str:
        orchestration_risk = self._normalize_risk(orchestration.get("nivel_riesgo"))

        if not guardrail:
            return orchestration_risk

        guardrail_risk = self._normalize_risk(guardrail.get("nivel_riesgo"))
        return self._max_risk(orchestration_risk, guardrail_risk)

    def _normalize_risk(self, raw: object) -> str:
        value = str(raw or "unknown").strip().lower()
        return _RISK_NORMALIZATION.get(value, "unknown")

    def _max_risk(self, left: str, right: str) -> str:
        return left if _RISK_ORDER[left] >= _RISK_ORDER[right] else right
