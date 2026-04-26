"""Meta reformulation stage: draft -> context-aware conversational output."""

from __future__ import annotations

import json
import logging
import os
import re
import sys
import threading
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

try:
    from groq import Groq
except Exception:  # pragma: no cover - optional dependency at import time
    Groq = None


logger = logging.getLogger(__name__)
load_dotenv(Path(__file__).resolve().parents[3] / ".env")
_METABRAIN_ROOT = Path(__file__).resolve().parents[3]
_GROQ_RECOMMENDED_PYTHON = "3.12"


@dataclass
class ReformulationResult:
    """Final text plus metadata generated during reformulation."""

    text: str
    variants_used: list[str] = field(default_factory=list)
    disclaimers: list[str] = field(default_factory=list)
    metadata: dict[str, object] = field(default_factory=dict)


class GroqMedicalPromptPipeline:
    """Optional Groq-driven refinement pipeline with safety guardrails."""

    _PROMPT_ORCHESTRATOR = """
Actua como un orquestador inteligente de generacion de lenguaje en un sistema medico.

Objetivo:
Analizar el texto de entrada y determinar como debe procesarse dentro del pipeline para maximizar:
- Fluidez
- Claridad
- Seguridad clinica
- Naturalidad

No generes la respuesta final.
Solo decide que acciones ejecutar.

Evaluar:
1) Calidad linguistica:
- El texto suena natural o robotico?
- Tiene repeticion?
- Le faltan conectores?

2) Claridad:
- Es comprensible o confuso?
- Esta bien estructurado?

3) Riesgo clinico:
- Puede contener afirmaciones inseguras?
- Hay conclusiones no justificadas?

4) Completitud:
- La respuesta esta incompleta?
- Le falta contexto?

Decidir:
- Si usar normalizacion
- Si usar reescritura
- Si usar refinamiento
- Si activar guardrail
- Si usar fallback

Responder SOLO en JSON:
{
    "usar_normalizer": true,
    "usar_rewriter": false,
    "usar_refiner": true,
    "usar_guardrail": true,
    "usar_fallback": false,
    "nivel_calidad": "baja | media | alta",
    "nivel_riesgo": "bajo | medio | alto"
}
""".strip()

    _PROMPT_REFINER = """
Actua como un refinador linguistico medico de alta precision.

Objetivo:
Mejorar la fluidez, naturalidad y claridad del texto sin alterar el significado clinico original.

Reglas estrictas:
- No agregar diagnosticos nuevos
- No inventar informacion
- No eliminar informacion relevante
- Mantener precision medica
- Evitar lenguaje robotico o repetitivo
- Variar estructura sintactica de forma natural
- Usar conectores si mejora la fluidez
- Mantener coherencia global

Estilo:
- Profesional pero humano
- Claro y fluido
- No excesivamente tecnico salvo que el texto lo sea

Entrada:
{input_text}

Salida:
Texto mejorado, natural y fluido.
""".strip()

    _PROMPT_FALLBACK = """
Actua como un asistente medico conversacional prudente.

Objetivo:
Generar una respuesta clara, util y segura cuando la informacion disponible es limitada o incierta.

Reglas:
- No inventar diagnosticos
- Expresar incertidumbre cuando corresponda
- Priorizar seguridad del paciente
- Sugerir consulta medica cuando aplique
- Usar lenguaje natural y empatico
- No sonar alarmista ni frio

Entrada:
{input_text}

Contexto:
{context}

Salida:
Respuesta clara, segura y natural.
""".strip()

    _PROMPT_GUARDRAIL = """
Actua como un verificador de seguridad medica.

Objetivo:
Analizar el texto y detectar si contiene:
- informacion inventada
- afirmaciones medicas inseguras
- conclusiones no justificadas
- lenguaje riesgoso

Reglas:
- No modificar el texto, solo evaluarlo
- Responder en formato JSON

Entrada:
{input_text}

Salida esperada:
{{
    "seguro": true,
    "problemas": ["..."],
    "nivel_riesgo": "bajo | medio | alto"
}}
""".strip()

    _PROMPT_REWRITER = """
Actua como un especialista en reescritura avanzada.

Objetivo:
Reformular el texto manteniendo el mismo significado, pero usando estructuras diferentes y evitando repeticion.

Reglas:
- No cambiar el contenido clinico
- Usar sinonimos apropiados
- Variar estructura de oracion
- Mantener claridad y coherencia

Entrada:
{input_text}

Salida:
Version alternativa del texto, mas natural y variada.
""".strip()

    _PROMPT_NORMALIZER = """
Actua como un normalizador de texto clinico.

Objetivo:
Corregir errores basicos antes del procesamiento:
- ortografia
- puntuacion
- espacios
- formato

Reglas:
- No cambiar significado
- No agregar informacion

Entrada:
{input_text}

Salida:
Texto corregido y limpio.
""".strip()

    _PROMPT_SELECTOR_HINT = """
Actua como un evaluador de calidad de respuesta.

Objetivo:
Determinar si el texto es suficientemente claro, fluido y seguro, o si requiere mejora.

Evaluar:
- Fluidez linguistica
- Claridad
- Coherencia
- Nivel de repeticion
- Calidad general

Responder SOLO en JSON valido:
{
    "usar_refiner": true,
    "usar_rewriter": false,
    "riesgo_detectado": false,
    "calidad": "alta"
}
""".strip()

    _PROMPT_FALLBACK_SUFFIX = (
        "Responde usando solo la informacion disponible. "
        "Si hay incertidumbre, explicitala de forma clara y prudente."
    )

    _PROMPT_GUARDRAIL_SUFFIX = (
        "Responde SOLO con JSON valido y sin texto extra. "
        "Usa exactamente las claves: seguro, nivel_riesgo, problemas."
    )

    _PROMPT_SELECTOR_HINT_SUFFIX = (
        "Responde SOLO con JSON valido y sin texto extra. "
        "Usa exactamente las claves: usar_refiner, usar_rewriter, riesgo_detectado, calidad."
    )

    _PROMPT_ORCHESTRATOR_SUFFIX = (
        "Responde SOLO con JSON valido y sin texto extra. "
        "Usa exactamente las claves: usar_normalizer, usar_rewriter, usar_refiner, usar_guardrail, "
        "usar_fallback, nivel_calidad, nivel_riesgo."
    )

    def __init__(self) -> None:
        api_key = os.getenv("GROQ_API_KEY", "").strip()
        enabled_raw = os.getenv("NLG_GROQ_ENABLED", "true").strip().lower()
        self._enabled = enabled_raw in {"1", "true", "yes", "on"} and bool(api_key)
        self._model = os.getenv("NLG_GROQ_MODEL", "llama3-70b-8192").strip() or "llama3-70b-8192"
        self._temperature = self._parse_float(os.getenv("NLG_GROQ_TEMPERATURE", "0.4"), default=0.4)
        self._max_tokens = self._parse_int(os.getenv("NLG_GROQ_MAX_TOKENS", "700"), default=700)
        rewriter_raw = os.getenv("NLG_GROQ_ENABLE_REWRITER", "true").strip().lower()
        self._rewriter_enabled = rewriter_raw in {"1", "true", "yes", "on"}
        self._prompt_sources: dict[str, dict[str, object]] = {}

        self._prompt_refiner = self._load_prompt_file("refiner.txt", self._PROMPT_REFINER)
        self._prompt_fallback = self._load_prompt_file("fallback.txt", self._PROMPT_FALLBACK)
        self._prompt_guardrail = self._load_prompt_file("guardrail.txt", self._PROMPT_GUARDRAIL)
        self._prompt_rewriter = self._load_prompt_file("rewriter.txt", self._PROMPT_REWRITER)
        self._prompt_normalizer = self._load_prompt_file("normalizer.txt", self._PROMPT_NORMALIZER)
        self._prompt_orchestrator = self._load_prompt_file("orchestrator.txt", self._PROMPT_ORCHESTRATOR)
        self._prompt_selector_hint = self._load_prompt_file("selector_hint.txt", self._PROMPT_SELECTOR_HINT)

        self._runtime_lock = threading.Lock()
        self._runtime_stats: dict[str, int] = {
            "requests_total": 0,
            "orchestrator_normalizer_enabled_total": 0,
            "orchestrator_rewriter_enabled_total": 0,
            "orchestrator_refiner_enabled_total": 0,
            "orchestrator_guardrail_enabled_total": 0,
            "orchestrator_forced_fallback_total": 0,
            "guardrail_triggered_total": 0,
            "fallback_applied_total": 0,
        }

        self._client = None
        self._warn_if_runtime_is_not_recommended()
        if self._enabled and Groq is not None:
            try:
                self._client = Groq(api_key=api_key)
            except Exception as exc:  # pragma: no cover - network/client init
                logger.warning("groq_client_init_failed", extra={"error": str(exc)})
                self._enabled = False
        elif self._enabled and Groq is None:
            logger.warning("groq_sdk_not_installed")
            self._enabled = False

    def _warn_if_runtime_is_not_recommended(self) -> None:
        if sys.version_info < (3, 11):
            logger.warning(
                "groq_python_runtime_unsupported",
                extra={
                    "python_version": sys.version.split()[0],
                    "recommended_python": _GROQ_RECOMMENDED_PYTHON,
                },
            )
            return

        if sys.version_info >= (3, 14):
            logger.warning(
                "groq_python_runtime_not_recommended",
                extra={
                    "python_version": sys.version.split()[0],
                    "recommended_range": "3.11-3.13",
                    "preferred_python": _GROQ_RECOMMENDED_PYTHON,
                },
            )

    @property
    def enabled(self) -> bool:
        return self._enabled and self._client is not None

    def diagnostic_status(self) -> dict[str, object]:
        """Return safe diagnostic information without exposing secrets."""
        api_key_configured = bool(os.getenv("GROQ_API_KEY", "").strip())
        enabled_by_env = os.getenv("NLG_GROQ_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}
        mode = "groq" if self.enabled else "deterministic"
        orchestrator_runtime = self._build_orchestrator_runtime_summary()
        return {
            "mode": mode,
            "groq_enabled": self.enabled,
            "groq_sdk_available": Groq is not None,
            "api_key_configured": api_key_configured,
            "enabled_by_env": enabled_by_env,
            "model": self._model,
            "temperature": self._temperature,
            "max_tokens": self._max_tokens,
            "rewriter_enabled": self._rewriter_enabled,
            "prompt_sources": self._prompt_sources,
            "orchestrator_runtime": orchestrator_runtime,
        }

    def refine(self, input_text: str, context: dict[str, object]) -> ReformulationResult:
        """Run orchestrator-driven dynamic flow over normalizer/rewriter/refiner/guardrail/fallback."""
        if not self.enabled:
            return ReformulationResult(
                text=input_text,
                metadata={
                    "llm_pipeline": {
                        "mode": "deterministic",
                        "orchestrator": None,
                        "selector_hint": None,
                        "guardrail": None,
                    }
                },
            )

        working_text = input_text
        used_variants: list[str] = []
        output_disclaimers: list[str] = []

        orchestration = self._run_orchestrator(input_text=working_text)
        used_variants.append("groq:orchestrator")

        if self._to_bool(orchestration.get("usar_normalizer", True), default=True):
            normalized = self._invoke_prompt(self._prompt_normalizer, user_text=working_text)
            if normalized:
                working_text = normalized
                used_variants.append("groq:normalizer")

        selector = self._orchestrator_to_selector_hint(orchestration)
        used_variants.append("groq:selector_hint")

        selector_use_rewriter = self._to_bool(orchestration.get("usar_rewriter", False), default=False)
        selector_use_refiner = self._to_bool(orchestration.get("usar_refiner", True), default=True)
        selector_use_guardrail = self._to_bool(orchestration.get("usar_guardrail", True), default=True)
        selector_use_fallback = self._to_bool(orchestration.get("usar_fallback", False), default=False)

        if self._rewriter_enabled and selector_use_rewriter:
            rewritten = self._invoke_prompt(self._prompt_rewriter, user_text=working_text)
            if rewritten:
                working_text = rewritten
                used_variants.append("groq:rewriter")

        if selector_use_refiner:
            refined = self._invoke_prompt(self._prompt_refiner, user_text=working_text)
            if refined:
                working_text = refined
                used_variants.append("groq:refiner")

        safety: dict[str, object] | None = None
        guardrail_triggered = False
        if selector_use_guardrail:
            safety = self._run_guardrail(input_text=working_text)
            used_variants.append("groq:guardrail")
            guardrail_triggered = not self._to_bool(safety.get("seguro", False), default=False)

        should_fallback = selector_use_fallback or guardrail_triggered
        if should_fallback:
            fallback_context = json.dumps(context, ensure_ascii=False)
            fallback = self._invoke_prompt(
                self._prompt_fallback,
                user_text=working_text,
                context_text=f"Contexto:\n{fallback_context}\n\n{self._PROMPT_FALLBACK_SUFFIX}",
            )
            if fallback:
                working_text = fallback
                used_variants.append("groq:fallback")

        if guardrail_triggered and safety is not None:
            risk_label = str(safety.get("nivel_riesgo", "medio")).strip().lower()
            output_disclaimers.append(f"groq_guardrail_triggered:{risk_label or 'medio'}")
            problems = safety.get("problemas", [])
            if isinstance(problems, list):
                for item in problems:
                    if isinstance(item, str) and item.strip():
                        output_disclaimers.append(f"guardrail_issue:{item.strip()}")

        if selector_use_fallback:
            output_disclaimers.append("groq_orchestrator_forced_fallback")

        self._record_runtime_metrics(
            selector_use_normalizer=self._to_bool(orchestration.get("usar_normalizer", True), default=True),
            selector_use_rewriter=selector_use_rewriter,
            selector_use_refiner=selector_use_refiner,
            selector_use_guardrail=selector_use_guardrail,
            selector_use_fallback=selector_use_fallback,
            guardrail_triggered=guardrail_triggered,
            fallback_applied=("groq:fallback" in used_variants),
        )

        pipeline_metadata = {
            "mode": "groq",
            "orchestrator": orchestration,
            "selector_hint": selector,
            "guardrail": safety,
            "rewriter_applied": "groq:rewriter" in used_variants,
            "refiner_applied": "groq:refiner" in used_variants,
            "fallback_applied": "groq:fallback" in used_variants,
        }

        return ReformulationResult(
            text=" ".join(working_text.split()),
            variants_used=used_variants,
            disclaimers=output_disclaimers,
            metadata={"llm_pipeline": pipeline_metadata},
        )

    def _run_orchestrator(self, input_text: str) -> dict[str, object]:
        raw = self._invoke_prompt(
            self._prompt_orchestrator,
            user_text=input_text,
            context_text=self._PROMPT_ORCHESTRATOR_SUFFIX,
        )
        default = {
            "usar_normalizer": True,
            "usar_rewriter": self._rewriter_enabled and self._looks_repetitive(input_text),
            "usar_refiner": True,
            "usar_guardrail": True,
            "usar_fallback": False,
            "nivel_calidad": "media",
            "nivel_riesgo": "bajo",
        }
        if not raw:
            return default

        parsed = self._safe_parse_json(raw)
        if not parsed:
            logger.warning("orchestrator_invalid_json")
            return default

        quality = str(parsed.get("nivel_calidad", "media")).strip().lower()
        if quality not in {"baja", "media", "alta"}:
            quality = "media"

        risk = str(parsed.get("nivel_riesgo", "bajo")).strip().lower()
        if risk not in {"bajo", "medio", "alto"}:
            risk = "medio"

        return {
            "usar_normalizer": self._to_bool(parsed.get("usar_normalizer", True), default=True),
            "usar_rewriter": self._to_bool(parsed.get("usar_rewriter", default["usar_rewriter"]), default=False),
            "usar_refiner": self._to_bool(parsed.get("usar_refiner", True), default=True),
            "usar_guardrail": self._to_bool(parsed.get("usar_guardrail", True), default=True),
            "usar_fallback": self._to_bool(parsed.get("usar_fallback", False), default=False),
            "nivel_calidad": quality,
            "nivel_riesgo": risk,
        }

    def _record_runtime_metrics(
        self,
        *,
        selector_use_normalizer: bool,
        selector_use_rewriter: bool,
        selector_use_refiner: bool,
        selector_use_guardrail: bool,
        selector_use_fallback: bool,
        guardrail_triggered: bool,
        fallback_applied: bool,
    ) -> None:
        with self._runtime_lock:
            self._runtime_stats["requests_total"] += 1
            if selector_use_normalizer:
                self._runtime_stats["orchestrator_normalizer_enabled_total"] += 1
            if selector_use_rewriter:
                self._runtime_stats["orchestrator_rewriter_enabled_total"] += 1
            if selector_use_refiner:
                self._runtime_stats["orchestrator_refiner_enabled_total"] += 1
            if selector_use_guardrail:
                self._runtime_stats["orchestrator_guardrail_enabled_total"] += 1
            if selector_use_fallback:
                self._runtime_stats["orchestrator_forced_fallback_total"] += 1
            if guardrail_triggered:
                self._runtime_stats["guardrail_triggered_total"] += 1
            if fallback_applied:
                self._runtime_stats["fallback_applied_total"] += 1

    def _build_orchestrator_runtime_summary(self) -> dict[str, object]:
        with self._runtime_lock:
            stats = dict(self._runtime_stats)

        total = max(0, stats.get("requests_total", 0))

        return {
            **stats,
            "normalizer_enabled_rate": self._safe_rate(
                stats.get("orchestrator_normalizer_enabled_total", 0),
                total,
            ),
            "rewriter_enabled_rate": self._safe_rate(
                stats.get("orchestrator_rewriter_enabled_total", 0),
                total,
            ),
            "refiner_enabled_rate": self._safe_rate(
                stats.get("orchestrator_refiner_enabled_total", 0),
                total,
            ),
            "guardrail_enabled_rate": self._safe_rate(
                stats.get("orchestrator_guardrail_enabled_total", 0),
                total,
            ),
            "forced_fallback_rate": self._safe_rate(
                stats.get("orchestrator_forced_fallback_total", 0),
                total,
            ),
            "guardrail_triggered_rate": self._safe_rate(
                stats.get("guardrail_triggered_total", 0),
                total,
            ),
            "fallback_applied_rate": self._safe_rate(
                stats.get("fallback_applied_total", 0),
                total,
            ),
        }

    def _orchestrator_to_selector_hint(self, orchestration: dict[str, object]) -> dict[str, object]:
        return {
            "usar_refiner": self._to_bool(orchestration.get("usar_refiner", True), default=True),
            "usar_rewriter": self._to_bool(orchestration.get("usar_rewriter", False), default=False),
            "riesgo_detectado": str(orchestration.get("nivel_riesgo", "bajo")).strip().lower() in {"medio", "alto"},
            "calidad": str(orchestration.get("nivel_calidad", "media")).strip().lower(),
        }

    def _run_selector_hint(self, input_text: str) -> dict[str, object]:
        # Backward-compatible adapter: selector_hint now derives from orchestrator decisions.
        return self._orchestrator_to_selector_hint(self._run_orchestrator(input_text=input_text))

    def _run_guardrail(self, input_text: str) -> dict[str, object]:
        raw = self._invoke_prompt(
            self._prompt_guardrail,
            user_text=input_text,
            context_text=self._PROMPT_GUARDRAIL_SUFFIX,
        )
        if not raw:
            return {"seguro": True, "problemas": [], "nivel_riesgo": "bajo"}

        parsed = self._safe_parse_json(raw)
        if not parsed:
            logger.warning("guardrail_invalid_json")
            return {"seguro": False, "problemas": ["guardrail_invalid_json"], "nivel_riesgo": "medio"}

        seguro = self._to_bool(parsed.get("seguro", False), default=False)
        problemas = parsed.get("problemas", [])
        nivel = str(parsed.get("nivel_riesgo", "medio")).strip().lower()
        if nivel not in {"bajo", "medio", "alto"}:
            nivel = "medio"

        return {
            "seguro": seguro,
            "problemas": problemas if isinstance(problemas, list) else ["invalid_problemas_type"],
            "nivel_riesgo": nivel,
        }

    def _invoke_prompt(self, prompt: str, *, user_text: str, context_text: str | None = None) -> str | None:
        if not self.enabled:
            return None
        try:
            messages: list[dict[str, str]] = [
                {"role": "system", "content": prompt},
                {"role": "user", "content": user_text},
            ]
            if context_text:
                messages.append({"role": "user", "content": context_text})

            response = self._client.chat.completions.create(
                model=self._model,
                temperature=self._temperature,
                max_tokens=self._max_tokens,
                messages=messages,
            )
            content = (response.choices[0].message.content or "").strip()
            return content or None
        except Exception as exc:  # pragma: no cover - runtime networking
            logger.warning(
                "groq_prompt_failed",
                extra={"error": str(exc), "model": self._model},
            )
            return None

    def _safe_parse_json(self, raw: str) -> dict[str, object] | None:
        try:
            return json.loads(raw)
        except Exception:
            pass

        block = re.search(r"\{[\s\S]*\}", raw)
        if not block:
            return None
        try:
            return json.loads(block.group(0))
        except Exception:
            return None

    def _looks_repetitive(self, text: str) -> bool:
        tokens = [tok for tok in re.split(r"\W+", text.lower()) if tok]
        if len(tokens) < 20:
            return False

        repeated = 0
        for idx in range(1, len(tokens)):
            if tokens[idx] == tokens[idx - 1]:
                repeated += 1

        unique_ratio = len(set(tokens)) / max(1, len(tokens))
        repeated_ratio = repeated / max(1, len(tokens))
        return repeated_ratio > 0.08 or unique_ratio < 0.45

    def _to_bool(self, value: object, *, default: bool) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return bool(value)
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"true", "1", "si", "yes", "on"}:
                return True
            if normalized in {"false", "0", "no", "off"}:
                return False
        return default

    def _safe_rate(self, numerator: int, denominator: int) -> float:
        if denominator <= 0:
            return 0.0
        ratio = float(numerator) / float(denominator)
        return round(max(0.0, min(1.0, ratio)), 4)

    def _parse_float(self, raw: str, default: float) -> float:
        try:
            value = float(raw)
        except Exception:
            return default
        return max(0.0, min(1.0, value))

    def _parse_int(self, raw: str, default: int) -> int:
        try:
            value = int(raw)
        except Exception:
            return default
        return max(128, min(2048, value))

    def _load_prompt_file(self, filename: str, fallback_prompt: str) -> str:
        prompts_dir_env = os.getenv("NLG_PROMPTS_DIR", "").strip()
        if prompts_dir_env:
            prompts_dir = Path(prompts_dir_env)
            if not prompts_dir.is_absolute():
                prompts_dir = _METABRAIN_ROOT / prompts_dir
            prompt_path = prompts_dir / filename
        else:
            prompt_path = _METABRAIN_ROOT / "metabrain" / "prompts" / filename

        try:
            content = prompt_path.read_text(encoding="utf-8").strip()
            if content:
                self._prompt_sources[filename] = {
                    "path": str(prompt_path.resolve()),
                    "loaded": True,
                    "fallback_used": False,
                }
                return content
        except Exception:
            logger.info("prompt_file_not_loaded", extra={"file": str(prompt_path), "fallback_used": True})

        self._prompt_sources[filename] = {
            "path": str(prompt_path),
            "loaded": False,
            "fallback_used": True,
        }

        return fallback_prompt


class MetaReformulator:
    """Applies progressive conversational style and history-aware phrasing."""

    def __init__(self) -> None:
        self._groq_pipeline = GroqMedicalPromptPipeline()

    def diagnostic_status(self) -> dict[str, object]:
        status = self._groq_pipeline.diagnostic_status()
        status["meta_rewriter"] = "groq" if status.get("mode") == "groq" else "rule_based"
        return status

    def reformulate(
        self,
        draft_text: str,
        *,
        style_stage: str,
        turn_index: int,
        history_size: int,
        component_slots: dict[str, str],
    ) -> ReformulationResult:
        text = draft_text.strip()

        prefix = self._build_progressive_prefix(
            style_stage=style_stage,
            turn_index=turn_index,
            history_size=history_size,
            bridging=component_slots.get("bridging", "neutral"),
        )
        if prefix:
            text = f"{prefix} {text}"

        text = self._apply_stage_rewrites(text=text, style_stage=style_stage)

        if style_stage == "directo" and "evaluacion medica" in text.lower() and "hoy" not in text.lower():
            text = f"{text} Prioriza esta evaluacion hoy."

        deterministic_text = " ".join(text.split())

        llm_result = self._groq_pipeline.refine(
            deterministic_text,
            context={
                "style_stage": style_stage,
                "turn_index": turn_index,
                "history_size": history_size,
                "component_slots": component_slots,
            },
        )
        if llm_result.text and llm_result.text != deterministic_text:
            llm_result.variants_used = ["meta_rewriter:groq"] + llm_result.variants_used
            return llm_result

        return ReformulationResult(
            text=deterministic_text,
            variants_used=["meta_rewriter:rule_based"],
            disclaimers=[],
            metadata=llm_result.metadata,
        )

    def _build_progressive_prefix(
        self,
        *,
        style_stage: str,
        turn_index: int,
        history_size: int,
        bridging: str,
    ) -> str:
        if style_stage == "formal":
            return "Con base en la informacion clinica disponible,"

        if style_stage == "cercano":
            if history_size >= 2:
                if bridging == "warm":
                    return "Gracias por compartir todo el historial,"
                return "Tomando en cuenta todo lo que ya hablamos,"
            return "Te acompano paso a paso con esto,"

        if history_size >= 2:
            return "Voy directo y con todo el historial de la conversacion,"
        return "Voy directo al punto,"

    def _apply_stage_rewrites(self, *, text: str, style_stage: str) -> str:
        if style_stage == "formal":
            return text

        replacements_cercano = {
            "Se recomienda": "Te recomiendo",
            "Se sugiere": "Te sugiero",
            "Es recomendable": "Te conviene",
            "Se indica": "Te indico",
        }

        replacements_directo = {
            "Se recomienda": "Busca",
            "Se sugiere": "Realiza",
            "Es recomendable": "Realiza",
            "Se indica": "Haz",
        }

        mapping = replacements_cercano if style_stage == "cercano" else replacements_directo
        rewritten = text
        for old, new in mapping.items():
            rewritten = rewritten.replace(old, new)

        if style_stage == "directo":
            rewritten = rewritten.replace("en conclusion", "punto final")
            rewritten = rewritten.replace("En conclusion", "Punto final")

        return rewritten
