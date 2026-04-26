"""Functional smoke test for Groq client + modular NLG pipeline.

Run from project root:
    python test_groq.py
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone

from metabrain.config import get_settings
from metabrain.groq_client import GroqClientError, get_runtime_metrics, run_prompt_full
from metabrain.pipeline import GroqLanguagePipeline


def main() -> int:
    settings = get_settings()
    print("== Groq Functional Test ==")
    print(f"Groq enabled: {settings.nlg_groq_enabled}")
    print(f"Model: {settings.nlg_groq_model}")
    print(f"Prompts dir: {settings.nlg_prompts_dir}")

    pipeline = GroqLanguagePipeline()

    if not settings.nlg_groq_enabled:
        print("[WARN] NLG_GROQ_ENABLED=false. Validando fallback deterministico.")
        result = pipeline.process("Dolor en el pecho desde hace 2 horas.")
        print("\n--- Resultado fallback ---")
        print(result.text)
        print("--------------------------")
        return 0

    system = "Sos un asistente medico que responde en espanol claro, seguro y sin inventar datos clinicos."
    user = "Paciente con fiebre y tos seca desde hace 48 horas. Explicalo de forma prudente."

    print("\n[1/2] Ejecutando run_prompt_full()...")
    try:
        prompt_result = run_prompt_full(
            system_prompt=system,
            user_prompt=user,
            timeout_seconds=20.0,
            use_cache=False,
        )
    except GroqClientError as exc:
        print(f"[ERROR] Cliente Groq: {exc}", file=sys.stderr)
        return 1

    print("Respuesta de Groq:")
    print(prompt_result.text)
    print(
        f"Tokens -> prompt: {prompt_result.prompt_tokens}, "
        f"completion: {prompt_result.completion_tokens}, total: {prompt_result.total_tokens}"
    )
    print(f"Latencia: {prompt_result.latency_ms} ms")

    print("\n[2/2] Ejecutando GroqLanguagePipeline.process()...")
    pipeline_input = (
        "Paciente con fiebre fiebre fiebre persistente, cansancio y tos nocturna. "
        "Necesita orientacion segura y clara."
    )
    pipeline_result = pipeline.process(
        pipeline_input,
        context={
            "entrypoint": "test_groq.py",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )

    print("\n--- Resultado pipeline ---")
    print(pipeline_result.text)
    print("--------------------------")
    print(f"Stages: {pipeline_result.stages_executed}")
    print(f"Fallback aplicado: {pipeline_result.fallback_applied}")
    print("Orchestrator:")
    print(json.dumps(pipeline_result.orchestration, ensure_ascii=False, indent=2))
    if pipeline_result.guardrail is not None:
        print("Guardrail:")
        print(json.dumps(pipeline_result.guardrail, ensure_ascii=False, indent=2))

    print("\nMetricas runtime:")
    print(json.dumps(get_runtime_metrics(), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
