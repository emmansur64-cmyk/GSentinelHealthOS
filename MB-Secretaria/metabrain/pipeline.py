"""Groq-driven language pipeline with orchestration, safety and fallback."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

from metabrain.config import NLGSettings, get_settings
from metabrain.groq_client import GroqClient, GroqClientError, get_runtime_metrics
from metabrain.logger import get_logger
from metabrain.prompt_loader import PromptLoader


logger = get_logger(__name__)


_DEFAULT_ORCHESTRATOR_PROMPT = """
Actua como un orquestador de procesamiento de lenguaje medico.
Analiza el texto y decide si aplicar normalizer, rewriter, refiner, guardrail o fallback.
Responde SOLO JSON valido con estas claves:
{
  "usar_normalizer": true,
  "usar_rewriter": false,
  "usar_refiner": true,
  "usar_guardrail": true,
  "usar_fallback": false,
  "nivel_calidad": "baja|media|alta",
  "nivel_riesgo": "bajo|medio|alto"
}
""".strip()

_DEFAULT_NORMALIZER_PROMPT = """
Actua como normalizador de texto clinico.
Corrige ortografia, puntuacion, espaciado y formato sin alterar el significado.
""".strip()

_DEFAULT_REWRITER_PROMPT = """
Actua como especialista en reescritura de alta variacion.
Mantiene significado clinico, evita repeticion y mejora naturalidad.
""".strip()

_DEFAULT_REFINER_PROMPT = """
Actua como refinador linguistico medico.
Mejora fluidez y coherencia sin introducir informacion clinica nueva.
""".strip()

_DEFAULT_GUARDRAIL_PROMPT = """
Actua como guardrail de seguridad clinica.
Evalua si el texto es seguro y responde SOLO JSON valido:
{"seguro": true, "nivel_riesgo": "bajo|medio|alto", "problemas": []}
""".strip()

_DEFAULT_FALLBACK_PROMPT = """
Actua como asistente medico prudente.
Cuando haya incertidumbre, no inventes diagnosticos y prioriza seguridad del paciente.
""".strip()

_ORCHESTRATOR_SUFFIX = (
    "Responde SOLO con JSON valido usando exactamente estas claves: "
    "usar_normalizer, usar_rewriter, usar_refiner, usar_guardrail, usar_fallback, nivel_calidad, nivel_riesgo."
)

_GUARDRAIL_SUFFIX = (
    "Responde SOLO con JSON valido y con las claves exactas: seguro, nivel_riesgo, problemas."
)


@dataclass(frozen=True)
class PipelineResult:
    text: str
    stages_executed: list[str] = field(default_factory=list)
    orchestration: dict[str, object] = field(default_factory=dict)
    guardrail: dict[str, object] | None = None
    fallback_applied: bool = False
    diagnostics: dict[str, object] = field(default_factory=dict)


class GroqLanguagePipeline:
    """Pipeline stage runner: orchestrator -> normalizer -> rewriter -> refiner -> guardrail -> fallback."""

    def __init__(
        self,
        *,
        client: GroqClient | None = None,
        prompt_loader: PromptLoader | None = None,
        settings: NLGSettings | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._client = client or GroqClient(settings=self._settings)
        self._prompt_loader = prompt_loader or PromptLoader(settings=self._settings)

        self._prompt_orchestrator = self._prompt_loader.load_prompt("orchestrator", fallback=_DEFAULT_ORCHESTRATOR_PROMPT)
        self._prompt_normalizer = self._prompt_loader.load_prompt("normalizer", fallback=_DEFAULT_NORMALIZER_PROMPT)
        self._prompt_rewriter = self._prompt_loader.load_prompt("rewriter", fallback=_DEFAULT_REWRITER_PROMPT)
        self._prompt_refiner = self._prompt_loader.load_prompt("refiner", fallback=_DEFAULT_REFINER_PROMPT)
        self._prompt_guardrail = self._prompt_loader.load_prompt("guardrail", fallback=_DEFAULT_GUARDRAIL_PROMPT)
        self._prompt_fallback = self._prompt_loader.load_prompt("fallback", fallback=_DEFAULT_FALLBACK_PROMPT)

    def diagnostic_status(self) -> dict[str, object]:
        return {
            "groq_enabled": self._settings.nlg_groq_enabled,
            "model": self._settings.nlg_groq_model,
            "temperature": self._settings.nlg_groq_temperature,
            "max_tokens": self._settings.nlg_groq_max_tokens,
            "rewriter_enabled": self._settings.nlg_groq_enable_rewriter,
            "prompts": self._prompt_loader.describe_sources(),
            "metrics": get_runtime_metrics(),
        }

    def process(self, input_text: str, *, context: dict[str, object] | None = None) -> PipelineResult:
        text = " ".join((input_text or "").split())
        context = context or {}
        if not text:
            return PipelineResult(
                text="",
                stages_executed=["noop"],
                diagnostics=self.diagnostic_status(),
            )

        if not self._settings.nlg_groq_enabled:
            fallback_text = self._deterministic_fallback(text, reason="groq_disabled")
            return PipelineResult(
                text=fallback_text,
                stages_executed=["fallback"],
                orchestration=self._default_orchestration(text),
                guardrail={"seguro": True, "nivel_riesgo": "bajo", "problemas": []},
                fallback_applied=True,
                diagnostics=self.diagnostic_status(),
            )

        stages: list[str] = []
        orchestration = self._run_orchestrator(text)
        stages.append("orchestrator")

        if orchestration["usar_normalizer"]:
            normalized = self._invoke_stage(self._prompt_normalizer, text)
            if normalized:
                text = normalized
                stages.append("normalizer")

        if self._settings.nlg_groq_enable_rewriter and orchestration["usar_rewriter"]:
            rewritten = self._invoke_stage(self._prompt_rewriter, text)
            if rewritten:
                text = rewritten
                stages.append("rewriter")

        if orchestration["usar_refiner"]:
            refined = self._invoke_stage(self._prompt_refiner, text)
            if refined:
                text = refined
                stages.append("refiner")

        guardrail_result: dict[str, object] | None = None
        guardrail_triggered = False
        if orchestration["usar_guardrail"]:
            guardrail_result = self._run_guardrail(text)
            guardrail_triggered = not self._to_bool(guardrail_result.get("seguro", False), default=False)
            stages.append("guardrail")

        should_fallback = bool(orchestration["usar_fallback"]) or guardrail_triggered
        if should_fallback:
            context_json = json.dumps(context, ensure_ascii=False)
            fallback_context = (
                "Usa tono prudente y claro. Si hay incertidumbre, explicitala.\n"
                f"Contexto adicional:\n{context_json}"
            )
            fallback = self._invoke_stage(self._prompt_fallback, text, context_text=fallback_context)
            if fallback:
                text = fallback
            else:
                text = self._deterministic_fallback(text, reason="fallback_stage_error")
            stages.append("fallback")

        diagnostics = self.diagnostic_status()
        diagnostics["orchestrator"] = orchestration
        diagnostics["guardrail"] = guardrail_result
        diagnostics["stages_executed"] = stages

        return PipelineResult(
            text=" ".join(text.split()),
            stages_executed=stages,
            orchestration=orchestration,
            guardrail=guardrail_result,
            fallback_applied=should_fallback,
            diagnostics=diagnostics,
        )

    def _run_orchestrator(self, input_text: str) -> dict[str, object]:
        raw = self._invoke_stage(
            self._prompt_orchestrator,
            input_text,
            context_text=_ORCHESTRATOR_SUFFIX,
        )
        default = self._default_orchestration(input_text)
        if not raw:
            return default

        parsed = self._safe_parse_json(raw)
        if not parsed:
            logger.error("orchestrator_invalid_json")
            return default

        quality = str(parsed.get("nivel_calidad", "media")).strip().lower()
        if quality not in {"baja", "media", "alta"}:
            quality = "media"

        risk = str(parsed.get("nivel_riesgo", "bajo")).strip().lower()
        if risk not in {"bajo", "medio", "alto"}:
            risk = "medio"

        return {
            "usar_normalizer": self._to_bool(parsed.get("usar_normalizer", default["usar_normalizer"]), default=True),
            "usar_rewriter": self._to_bool(parsed.get("usar_rewriter", default["usar_rewriter"]), default=False),
            "usar_refiner": self._to_bool(parsed.get("usar_refiner", default["usar_refiner"]), default=True),
            "usar_guardrail": self._to_bool(parsed.get("usar_guardrail", default["usar_guardrail"]), default=True),
            "usar_fallback": self._to_bool(parsed.get("usar_fallback", default["usar_fallback"]), default=False),
            "nivel_calidad": quality,
            "nivel_riesgo": risk,
        }

    def _run_guardrail(self, input_text: str) -> dict[str, object]:
        raw = self._invoke_stage(
            self._prompt_guardrail,
            input_text,
            context_text=_GUARDRAIL_SUFFIX,
        )
        if not raw:
            return {
                "seguro": False,
                "nivel_riesgo": "medio",
                "problemas": ["guardrail_sin_respuesta"],
            }

        parsed = self._safe_parse_json(raw)
        if not parsed:
            return {
                "seguro": False,
                "nivel_riesgo": "medio",
                "problemas": ["guardrail_invalid_json"],
            }

        problems = parsed.get("problemas", [])
        if not isinstance(problems, list):
            problems = ["invalid_problemas_type"]

        risk = str(parsed.get("nivel_riesgo", "medio")).strip().lower()
        if risk not in {"bajo", "medio", "alto"}:
            risk = "medio"

        return {
            "seguro": self._to_bool(parsed.get("seguro", False), default=False),
            "nivel_riesgo": risk,
            "problemas": [str(item) for item in problems if str(item).strip()],
        }

    def _default_orchestration(self, input_text: str) -> dict[str, object]:
        return {
            "usar_normalizer": True,
            "usar_rewriter": self._settings.nlg_groq_enable_rewriter and self._looks_repetitive(input_text),
            "usar_refiner": True,
            "usar_guardrail": True,
            "usar_fallback": False,
            "nivel_calidad": "media",
            "nivel_riesgo": "bajo",
        }

    def _invoke_stage(self, prompt: str, user_text: str, context_text: str | None = None) -> str | None:
        effective_user_text = user_text
        if context_text:
            effective_user_text = f"{user_text}\n\n{context_text}"

        try:
            response = self._client.run_prompt(
                system_prompt=prompt,
                user_prompt=effective_user_text,
            )
            return response.text.strip() if response.text else None
        except GroqClientError as exc:
            logger.error("pipeline_stage_failed", extra={"error": str(exc)})
            return None

    def _safe_parse_json(self, raw: str) -> dict[str, object] | None:
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return parsed
            return None
        except Exception:
            pass

        block = re.search(r"\{[\s\S]*\}", raw)
        if not block:
            return None
        try:
            parsed = json.loads(block.group(0))
            return parsed if isinstance(parsed, dict) else None
        except Exception:
            return None

    def _looks_repetitive(self, text: str) -> bool:
        tokens = [token for token in re.split(r"\W+", text.lower()) if token]
        if len(tokens) < 20:
            return False

        repeated_adjacent = 0
        for index in range(1, len(tokens)):
            if tokens[index] == tokens[index - 1]:
                repeated_adjacent += 1

        unique_ratio = len(set(tokens)) / max(1, len(tokens))
        repeated_ratio = repeated_adjacent / max(1, len(tokens))
        return repeated_ratio > 0.08 or unique_ratio < 0.45

    def _to_bool(self, value: object, *, default: bool) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return bool(value)
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on", "si"}:
                return True
            if normalized in {"0", "false", "no", "off"}:
                return False
        return default

    def _deterministic_fallback(self, text: str, *, reason: str) -> str:
        logger.info("deterministic_fallback", extra={"reason": reason})
        return (
            "Con la informacion disponible no es posible dar una conclusion clinica definitiva. "
            "Te recomiendo una evaluacion medica presencial para confirmar hallazgos y definir conducta segura."
        )
