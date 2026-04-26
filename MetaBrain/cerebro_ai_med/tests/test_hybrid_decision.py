from __future__ import annotations

from typing import Any

from metabrain.pipeline import PipelineResult

from cerebro_ai_med.decision.hybrid_decision import HybridDecisionOrchestrator


class _DecisionEngineStub:
    def __init__(self, payload: dict[str, Any]) -> None:
        self._payload = payload

    def interpret(self, model_output: dict[str, Any], patient_context: dict[str, Any] | None = None) -> dict[str, Any]:
        return dict(self._payload)


class _GroqPipelineStub:
    def __init__(self, result: PipelineResult | Exception) -> None:
        self._result = result

    def process(self, input_text: str, *, context: dict[str, object] | None = None) -> PipelineResult:
        if isinstance(self._result, Exception):
            raise self._result
        return self._result


def _model_output() -> dict[str, Any]:
    return {
        "risk_level": "low",
        "finding_code": "stable_pattern",
        "confidence": 0.62,
        "probabilities": {"low": 0.62, "medium": 0.24, "high": 0.14},
    }


def test_hybrid_decision_aligned_low_risk() -> None:
    decision_engine = _DecisionEngineStub(
        {
            "risk_level": "low",
            "urgency": "routine",
            "action_plan": "routine_monitoring",
            "follow_up_hours": 72,
            "deferred": False,
            "decision_score": 0.51,
        }
    )
    groq_pipeline = _GroqPipelineStub(
        PipelineResult(
            text="Caso estable, seguimiento recomendado.",
            stages_executed=["orchestrator", "guardrail"],
            orchestration={"nivel_riesgo": "bajo"},
            guardrail={"seguro": True, "nivel_riesgo": "bajo", "problemas": []},
            fallback_applied=False,
        )
    )

    orchestrator = HybridDecisionOrchestrator(decision_engine=decision_engine, groq_pipeline=groq_pipeline)
    result = orchestrator.decide(model_output=_model_output(), modality="TEXT", input_text="dolor leve")

    assert result["final_risk_level"] == "low"
    assert result["consensus"] == "aligned"
    assert result["source_count"] == 2


def test_hybrid_decision_escalates_when_groq_detects_higher_risk() -> None:
    decision_engine = _DecisionEngineStub(
        {
            "risk_level": "low",
            "urgency": "routine",
            "action_plan": "routine_monitoring",
            "follow_up_hours": 72,
            "deferred": False,
            "decision_score": 0.32,
        }
    )
    groq_pipeline = _GroqPipelineStub(
        PipelineResult(
            text="Signos de alto riesgo, requiere evaluacion inmediata.",
            stages_executed=["orchestrator", "guardrail"],
            orchestration={"nivel_riesgo": "alto"},
            guardrail={"seguro": False, "nivel_riesgo": "alto", "problemas": ["risk_escalation"]},
            fallback_applied=True,
        )
    )

    orchestrator = HybridDecisionOrchestrator(decision_engine=decision_engine, groq_pipeline=groq_pipeline)
    result = orchestrator.decide(model_output=_model_output(), modality="TEXT", input_text="dolor toracico")

    assert result["final_risk_level"] == "high"
    assert result["consensus"] == "escalated_by_groq"
    assert result["final_action_plan"] == "mandatory_manual_clinical_review"


def test_hybrid_decision_falls_back_to_cerebro_if_groq_errors() -> None:
    decision_engine = _DecisionEngineStub(
        {
            "risk_level": "medium",
            "urgency": "priority",
            "action_plan": "same_day_clinical_review",
            "follow_up_hours": 6,
            "deferred": False,
            "decision_score": 0.66,
        }
    )
    groq_pipeline = _GroqPipelineStub(RuntimeError("groq_temporarily_unavailable"))

    orchestrator = HybridDecisionOrchestrator(decision_engine=decision_engine, groq_pipeline=groq_pipeline)
    result = orchestrator.decide(model_output=_model_output(), modality="TEXT", input_text="tos y fiebre")

    assert result["final_risk_level"] == "medium"
    assert result["consensus"] == "cerebro_primary"
    assert result["groq"]["enabled"] is False
    assert result["groq"]["risk_level"] == "unknown"
