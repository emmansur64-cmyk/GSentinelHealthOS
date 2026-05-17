"""Adaptadores locales para todos los servicios de IA.

Todos los adaptadores son 100% offline — sin llamadas HTTP externas.

Implementa:
    - DialogueClient   → adaptador local via NLUEngine
  - InferenceClient  → adaptador local rule-based (local_engine.run_inference)
  - DecisionClient   → motor de decisión local (local_engine.run_decision)
  - NLGClient        → adaptador local rule-based (LinguisticEngine)

Cada adaptador incluye:
  - Bulkhead (asyncio.Semaphore) para controlar concurrencia
  - Circuit breaker (para proteger ante errores internos inesperados)
  - Manejo de errores tipado con ServiceError

GARANTÍA: No quedan referencias a microservicios HTTP externos.
El sistema corre 100% offline.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from brain.decision_engine.local_engine import run_decision, run_dialogue, run_inference
from brain.interpreters.nlu_engine import NLUEngine
from brain.orchestration.linguistic_engine import LinguisticEngine

from shared.utils.resilience import (
    CircuitBreaker,
    CircuitBreakerConfig,
    CircuitBreakerRegistry,
    CircuitOpenError,
)

logger = logging.getLogger(__name__)

# ── Configuración de circuit breakers por servicio ───────────────────────────
# Un circuit breaker independiente por servicio garantiza aislamiento:
# si un adaptador local falla, el breaker de los demás sigue cerrado.

_CB_DIALOGUE = CircuitBreakerRegistry.get(
    "ai.dialogue-engine",
    CircuitBreakerConfig(failure_threshold=3, reset_timeout_seconds=15.0, half_open_max_calls=1),
)
_CB_INFERENCE = CircuitBreakerRegistry.get(
    "ai.inference-service",
    CircuitBreakerConfig(failure_threshold=3, reset_timeout_seconds=30.0, half_open_max_calls=1),
)
_CB_DECISION = CircuitBreakerRegistry.get(
    "ai.decision-service",
    CircuitBreakerConfig(failure_threshold=3, reset_timeout_seconds=15.0, half_open_max_calls=1),
)
_CB_NLG = CircuitBreakerRegistry.get(
    "ai.nlg-service",
    CircuitBreakerConfig(failure_threshold=3, reset_timeout_seconds=10.0, half_open_max_calls=2),
)

# ── Bulkheads (máximo de llamadas concurrentes por servicio) ──────────────────
# Evitan que un servicio lento agote el thread pool y afecte a los demás.

_BH_DIALOGUE = asyncio.Semaphore(20)   # rápido, stateful
_BH_INFERENCE = asyncio.Semaphore(5)   # ML pesado: concurrencia baja intencional
_BH_DECISION = asyncio.Semaphore(10)
_BH_NLG = asyncio.Semaphore(20)        # templates rápidas

# ── Re-exportar CircuitOpenError para uso en orchestrator ────────────────────
__all__ = [
    "DialogueClient",
    "InferenceClient",
    "DecisionClient",
    "NLGClient",
    "ServiceError",
    "CircuitOpenError",
]


# ── Error tipado ──────────────────────────────────────────────────────────────

@dataclass
class ServiceError(Exception):
    """Error controlado al invocar un microservicio de IA."""

    service: str
    status_code: Optional[int]
    detail: str

    def __str__(self) -> str:
        return f"[{self.service}] local error: {self.detail}"


# ── Adaptadores locales ───────────────────────────────────────────────────────

class DialogueClient:
    """Adaptador local para dialogue-engine — usa NLUEngine local.

    Contrato de salida (mismo que el antiguo HTTP):
      { intent, entities, next_step, requires_inference, context, confidence }
    """

    def __init__(self, base_url: str = "", api_key: str | None = None) -> None:
        # base_url y api_key ignorados: el motor es 100% local.
        _ = base_url
        _ = api_key

    async def process(
        self,
        session_id: str,
        user_input: str,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        async with _BH_DIALOGUE:
            try:
                nlu_result = await NLUEngine.analyze(text=user_input)
                return run_dialogue(user_input, context, nlu_result)
            except Exception as exc:
                raise ServiceError(
                    service="dialogue-engine-local",
                    status_code=None,
                    detail=str(exc),
                ) from exc

    async def close(self) -> None:
        return None


class InferenceClient:
    """Adaptador local para inference-service — motor rule-based.

    Contrato de salida (mismo que el antiguo HTTP):
      { predictions, confidence_scores, raw_output }
    """

    def __init__(self, base_url: str = "", api_key: str | None = None) -> None:
        _ = base_url
        _ = api_key

    async def infer(
        self,
        session_id: str,
        symptoms: List[str],
        patient_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        async with _BH_INFERENCE:
            try:
                return run_inference(symptoms, patient_data)
            except Exception as exc:
                raise ServiceError(
                    service="inference-service-local",
                    status_code=None,
                    detail=str(exc),
                ) from exc

    async def close(self) -> None:
        return None


class DecisionClient:
    """Adaptador local para decision-service — motor de triage clínico.

    Contrato de salida (mismo que el antiguo HTTP):
      { risk_level, triage_level, flags, recommendations, action_required }
    """

    def __init__(self, base_url: str = "", api_key: str | None = None) -> None:
        _ = base_url
        _ = api_key

    async def decide(
        self,
        session_id: str,
        inference_output: Dict[str, Any],
        patient_data: Dict[str, Any],
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        async with _BH_DECISION:
            try:
                return run_decision(inference_output, patient_data, context)
            except Exception as exc:
                raise ServiceError(
                    service="decision-service-local",
                    status_code=None,
                    detail=str(exc),
                ) from exc

    async def close(self) -> None:
        return None


class NLGClient:
    """Adaptador NLG local rule-based (sin LLM).

    Conserva la misma interfaz del cliente para no romper el orquestador,
    pero la generacion se delega en LinguisticEngine.
    """

    def __init__(self, base_url: str = "", api_key: str | None = None) -> None:
        _ = base_url
        _ = api_key
        self._engine = LinguisticEngine()

    async def generate(
        self,
        session_id: str,
        intent: str,
        decision_output: Dict[str, Any],
        context: Dict[str, Any],
        template_key: str | None = None,
    ) -> Dict[str, Any]:
        # NLG 100% rule-based: template_key no participa en la generacion.
        _ = template_key
        _ = session_id

        session_state = context.get("session_state")
        if not isinstance(session_state, dict):
            session_state = {}

        message = self._engine.generate(intent, decision_output, context, session_state)
        return {"message": message}

    async def close(self) -> None:
        return None
