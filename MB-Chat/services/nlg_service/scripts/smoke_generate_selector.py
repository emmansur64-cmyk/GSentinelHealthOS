from __future__ import annotations

import json
from copy import deepcopy

from fastapi.testclient import TestClient

from services.nlg_service.app.main import app
from services.nlg_service.app import routes


def run_case(name: str, selector_payload: dict[str, object]) -> dict[str, object]:
    engine = routes._engine
    pipeline = engine._reformulator._groq_pipeline

    # Force Groq path without external API calls (controlled smoke test).
    pipeline._enabled = True
    pipeline._client = object()

    original_run_selector_hint = pipeline._run_selector_hint
    original_invoke_prompt = pipeline._invoke_prompt

    def fake_run_selector_hint(input_text: str) -> dict[str, object]:
        return deepcopy(selector_payload)

    def fake_invoke_prompt(prompt: str, *, user_text: str, context_text: str | None = None) -> str | None:
        if prompt == pipeline._prompt_normalizer:
            return user_text
        if prompt == pipeline._prompt_rewriter:
            return f"{user_text} [rewritten]"
        if prompt == pipeline._prompt_refiner:
            return f"{user_text} [refined]"
        if prompt == pipeline._prompt_guardrail:
            return json.dumps({"seguro": True, "nivel_riesgo": "bajo", "problemas": []}, ensure_ascii=False)
        if prompt == pipeline._prompt_fallback:
            return user_text
        return user_text

    pipeline._run_selector_hint = fake_run_selector_hint
    pipeline._invoke_prompt = fake_invoke_prompt

    try:
        client = TestClient(app)
        payload = {
            "dialogue_action": {"intent": "symptom_report", "next_step": "prioritize_response"},
            "decision_output": {
                "risk_level": "medium",
                "clinical_flag": "priority",
                "requires_medical_evaluation": True,
                "triage_level": "yellow",
                "confidence_band": "medium",
                "explanations": ["respiratory_issue"],
            },
            "model_output": {
                "model_name": "medical_triage_v3",
                "model_version": "1.2.0",
                "risk_level": "medium",
                "finding_code": "mild_infiltrate",
                "confidence": 0.72,
                "probabilities": {"low": 0.15, "medium": 0.72, "high": 0.13},
                "recommendation_code": "priority_evaluation",
                "features_used": {"fever": 1.0, "cough": 0.9},
            },
            "symptoms": ["fever", "cough"],
            "patient_context": {},
            "conversation_history": [],
        }

        response = client.post("/generate", json=payload)
        body = response.json()

        return {
            "case": name,
            "status_code": response.status_code,
            "uses_rewriter_variant": "groq:rewriter" in body.get("variants_used", []),
            "selector_hint": body.get("metadata", {}).get("llm_pipeline", {}).get("selector_hint"),
            "guardrail": body.get("metadata", {}).get("llm_pipeline", {}).get("guardrail"),
            "metadata_llm": body.get("metadata", {}).get("llm_pipeline", {}),
        }
    finally:
        pipeline._run_selector_hint = original_run_selector_hint
        pipeline._invoke_prompt = original_invoke_prompt


if __name__ == "__main__":
    low_quality = run_case(
        "calidad_baja_rewriter_on",
        {
            "usar_refiner": True,
            "usar_rewriter": True,
            "riesgo_detectado": False,
            "calidad": "baja",
        },
    )
    high_quality = run_case(
        "calidad_alta_rewriter_off",
        {
            "usar_refiner": True,
            "usar_rewriter": False,
            "riesgo_detectado": False,
            "calidad": "alta",
        },
    )

    print(json.dumps({"results": [low_quality, high_quality]}, ensure_ascii=False, indent=2))
