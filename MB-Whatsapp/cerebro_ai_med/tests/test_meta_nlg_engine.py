from __future__ import annotations

from services.nlg_service.app.engine import NLGEngine
from services.shared.contracts import DecisionOutput, ModelOutput


def _decision_output(risk_level: str = "medium") -> DecisionOutput:
    return DecisionOutput(
        risk_level=risk_level,
        clinical_flag="priority" if risk_level != "high" else "urgent",
        requires_medical_evaluation=True,
        triage_level="yellow" if risk_level != "high" else "red",
        confidence_band="medium",
        explanations=["pneumonia_possible"],
    )


def _model_output(risk_level: str = "medium") -> ModelOutput:
    return ModelOutput(
        model_name="demo-model",
        model_version="1.0.0",
        risk_level=risk_level,
        finding_code="pneumonia_possible",
        confidence=0.82,
        probabilities={"low": 0.08, "medium": 0.82, "high": 0.10},
        recommendation_code="review_priority",
        features_used={"feat_a": 0.4, "feat_b": 0.6},
    )


def test_meta_nlg_progressive_style_markers() -> None:
    engine = NLGEngine()

    base_context = {
        "conversation_history": [
            {"role": "user", "text": "inicio"},
            {"role": "assistant", "text": "respuesta previa"},
        ]
    }

    res_formal = engine.generate(
        decision_output=_decision_output("low"),
        model_output=_model_output("low"),
        dialogue_intent="follow_up_question",
        symptoms=["cough", "fever"],
        patient_context={"conversation_history": [], "turn_index": 1},
    )
    res_cercano = engine.generate(
        decision_output=_decision_output("medium"),
        model_output=_model_output("medium"),
        dialogue_intent="follow_up_question",
        symptoms=["cough", "fever"],
        patient_context={**base_context, "turn_index": 3},
    )
    res_directo = engine.generate(
        decision_output=_decision_output("high"),
        model_output=_model_output("high"),
        dialogue_intent="follow_up_question",
        symptoms=["cough", "fever"],
        patient_context={**base_context, "turn_index": 5},
    )

    assert "meta_stage:formal" in res_formal["variants_used"]
    assert "meta_stage:cercano" in res_cercano["variants_used"]
    assert "meta_stage:directo" in res_directo["variants_used"]


def test_meta_nlg_uses_full_history_and_components() -> None:
    engine = NLGEngine()
    history = [
        {"role": "user", "text": "tengo fiebre"},
        {"role": "assistant", "text": "recomendacion inicial"},
        {"role": "user", "text": "ahora tengo mas dolor"},
        {"role": "assistant", "text": "vigilar progresion"},
    ]

    result = engine.generate(
        decision_output=_decision_output("medium"),
        model_output=_model_output("medium"),
        dialogue_intent="severity_question",
        symptoms=["fever", "dyspnea"],
        patient_context={"conversation_history": history},
    )

    assert "meta_history_size:4" in result["variants_used"]
    assert any(v.startswith("component:framing:") for v in result["variants_used"])
    assert any(v.startswith("component:certainty:") for v in result["variants_used"])
    assert any(v.startswith("component:bridging:") for v in result["variants_used"])
    assert "historial" in result["message"].lower() or "hablamos" in result["message"].lower()
