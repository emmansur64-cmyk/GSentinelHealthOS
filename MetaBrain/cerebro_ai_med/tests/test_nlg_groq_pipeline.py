from __future__ import annotations

from fastapi.testclient import TestClient

from services.nlg_service.app.main import app
from services.nlg_service.app.reformulator import GroqMedicalPromptPipeline


def _build_enabled_pipeline() -> GroqMedicalPromptPipeline:
    pipeline = GroqMedicalPromptPipeline()
    pipeline._enabled = True
    pipeline._client = object()
    pipeline._rewriter_enabled = False
    return pipeline


def test_guardrail_invalid_json_triggers_fallback(monkeypatch) -> None:
    pipeline = _build_enabled_pipeline()

    def fake_invoke(prompt: str, *, user_text: str, context_text: str | None = None) -> str | None:
        if prompt == pipeline._prompt_orchestrator:
            return (
                '{"usar_normalizer": true, "usar_rewriter": false, "usar_refiner": true, '
                '"usar_guardrail": true, "usar_fallback": false, '
                '"nivel_calidad": "media", "nivel_riesgo": "medio"}'
            )
        if prompt == pipeline._prompt_normalizer:
            return user_text
        if prompt == pipeline._prompt_refiner:
            return "texto refinado"
        if prompt == pipeline._prompt_guardrail:
            return "esto no es json"
        if prompt == pipeline._prompt_fallback:
            return "respuesta fallback segura"
        return None

    monkeypatch.setattr(pipeline, "_invoke_prompt", fake_invoke)

    result = pipeline.refine("texto original", {"source": "test"})

    assert result.text == "respuesta fallback segura"
    assert "groq:fallback" in result.variants_used
    assert "groq_guardrail_triggered:medio" in result.disclaimers
    assert "guardrail_issue:guardrail_invalid_json" in result.disclaimers


def test_guardrail_unsafe_json_triggers_fallback(monkeypatch) -> None:
    pipeline = _build_enabled_pipeline()

    def fake_invoke(prompt: str, *, user_text: str, context_text: str | None = None) -> str | None:
        if prompt == pipeline._prompt_orchestrator:
            return (
                '{"usar_normalizer": true, "usar_rewriter": false, "usar_refiner": true, '
                '"usar_guardrail": true, "usar_fallback": false, '
                '"nivel_calidad": "media", "nivel_riesgo": "alto"}'
            )
        if prompt == pipeline._prompt_normalizer:
            return user_text
        if prompt == pipeline._prompt_refiner:
            return "texto refinado potencialmente riesgoso"
        if prompt == pipeline._prompt_guardrail:
            return '{"seguro": false, "problemas": ["conclusion no justificada"], "nivel_riesgo": "alto"}'
        if prompt == pipeline._prompt_fallback:
            return "respuesta prudente de fallback"
        return None

    monkeypatch.setattr(pipeline, "_invoke_prompt", fake_invoke)

    result = pipeline.refine("texto original", {"source": "test"})

    assert result.text == "respuesta prudente de fallback"
    assert "groq:fallback" in result.variants_used
    assert "groq_guardrail_triggered:alto" in result.disclaimers
    assert "guardrail_issue:conclusion no justificada" in result.disclaimers


def test_orchestrator_forces_fallback_without_guardrail(monkeypatch) -> None:
    pipeline = _build_enabled_pipeline()

    def fake_invoke(prompt: str, *, user_text: str, context_text: str | None = None) -> str | None:
        if prompt == pipeline._prompt_orchestrator:
            return (
                '{"usar_normalizer": false, "usar_rewriter": false, "usar_refiner": false, '
                '"usar_guardrail": false, "usar_fallback": true, '
                '"nivel_calidad": "baja", "nivel_riesgo": "medio"}'
            )
        if prompt == pipeline._prompt_fallback:
            return "fallback por orquestador"
        return None

    monkeypatch.setattr(pipeline, "_invoke_prompt", fake_invoke)

    result = pipeline.refine("texto original", {"source": "test"})

    assert result.text == "fallback por orquestador"
    assert "groq:orchestrator" in result.variants_used
    assert "groq:fallback" in result.variants_used
    assert "groq_orchestrator_forced_fallback" in result.disclaimers
    assert result.metadata["llm_pipeline"]["orchestrator"]["usar_fallback"] is True
    assert result.metadata["llm_pipeline"]["guardrail"] is None


def test_internal_llm_status_endpoint_requires_token(monkeypatch) -> None:
    monkeypatch.setenv("NLG_INTERNAL_DIAGNOSTICS_ENABLED", "true")
    monkeypatch.setenv("NLG_INTERNAL_DIAGNOSTICS_TOKEN", "internal-secret")

    client = TestClient(app)

    forbidden = client.get("/internal/diagnostics/llm-status")
    assert forbidden.status_code == 403

    ok = client.get(
        "/internal/diagnostics/llm-status",
        headers={"X-Internal-Token": "internal-secret"},
    )
    assert ok.status_code == 200
    body = ok.json()
    assert body["mode"] in {"groq", "deterministic"}
    assert body["meta_rewriter"] in {"groq", "rule_based"}
    assert "orchestrator_runtime" in body
    assert isinstance(body["orchestrator_runtime"], dict)
    assert "requests_total" in body["orchestrator_runtime"]
