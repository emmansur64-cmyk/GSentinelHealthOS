"""FastAPI app del Brain — Orquestador Central de GSentinelH.

Expone dos capacidades en paralelo:
  1. HTTP REST  → /orchestrate  (IntelligentOrchestrator)
  2. Redis worker              (BrainWorker existente, no modificado)

El worker Redis se lanza en background al iniciar la app.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager
from typing import Any, Dict, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from brain.core.config import settings
from brain.orchestration.clients import (
    DecisionClient,
    DialogueClient,
    InferenceClient,
    NLGClient,
)
from brain.orchestration.orchestrator import IntelligentOrchestrator
from brain.orchestration.session_manager import OrchestratorSessionManager

logger = logging.getLogger(__name__)


def _env_flag(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


# ── Schemas de request/response ───────────────────────────────────────────────

class OrchestrationRequest(BaseModel):
    user_input: str = Field(..., min_length=1, max_length=4096, description="Texto del usuario")
    session_id: Optional[str] = Field(
        default=None,
        description="ID de sesión existente. Si es null, se genera uno nuevo.",
    )
    context: Dict[str, Any] = Field(
        default_factory=dict,
        description="Contexto clínico y conversacional adicional enviado por el caller.",
    )


class OrchestrationMetadata(BaseModel):
    risk_level: str
    triage_level: str
    flags: list[str]
    confidence: float
    inference_cached: bool
    turn_count: int
    explanation_count: int
    request_id: str
    services_called: list[str]
    latency_ms: int
    context_type: Optional[str] = None


class OrchestrationResponse(BaseModel):
    message: str
    session_id: str
    metadata: OrchestrationMetadata


# ── Factory del orquestador ───────────────────────────────────────────────────

def _build_orchestrator() -> IntelligentOrchestrator:
    """Construye IntelligentOrchestrator con adaptadores locales (100% offline)."""
    return IntelligentOrchestrator(
        dialogue_client=DialogueClient(),
        inference_client=InferenceClient(),
        decision_client=DecisionClient(),
        nlg_client=NLGClient(base_url=settings.nlg_service_url),
        session_manager=OrchestratorSessionManager(),
    )


# ── Lifespan: arrancar/detener recursos ───────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Iniciando Brain — IntelligentOrchestrator")
    orchestrator = _build_orchestrator()
    app.state.orchestrator = orchestrator

    # Arrancar el worker Redis en background (booking existente)
    from brain.main import BrainWorker  # import diferido para evitar circular

    worker_enabled = _env_flag("ENABLE_BRAIN_REDIS_WORKER", default=False)
    worker = None
    worker_task = None

    if worker_enabled:
        worker = BrainWorker()
        worker_task = asyncio.create_task(worker.start())
        app.state.brain_worker = worker
        app.state.brain_worker_task = worker_task
        logger.info("Brain Redis WhatsApp legacy worker enabled by flag ENABLE_BRAIN_REDIS_WORKER")
    else:
        logger.info("Brain Redis WhatsApp legacy worker disabled; Next/BullMQ is primary pipeline")

    logger.info(
        "Brain listo | HTTP=%s:%d | Redis worker activo",
        settings.brain_host,
        settings.brain_port,
    )

    try:
        yield
    finally:
        await orchestrator.close()
        if worker is not None:
            await worker.stop()
        if worker_task is not None:
            worker_task.cancel()
            try:
                await worker_task
            except asyncio.CancelledError:
                pass
        logger.info("Brain detenido correctamente.")


# ── Aplicación FastAPI ────────────────────────────────────────────────────────

app = FastAPI(
    title="GSentinelH — Orquestador Central Inteligente",
    description=(
        "Orquesta dialogue-engine, inference-service, decision-service y nlg-service. "
        "No contiene lógica médica."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


# ── Autenticación de clave interna ────────────────────────────────────────────

def _verify_internal_key(x_internal_key: str = Header(default="")) -> None:
    """Valida X-Internal-Key si INTERNAL_SERVICES_KEY está configurado."""
    expected = settings.internal_services_key
    if not expected:
        return  # Sin clave configurada: modo desarrollo, sin restricción
    if x_internal_key != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-Internal-Key inválida o ausente.",
        )


def _get_orchestrator(request: Request) -> IntelligentOrchestrator:
    return request.app.state.orchestrator


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health", tags=["ops"])
async def health() -> Dict[str, str]:
    """Health check del orquestador."""
    return {"status": "ok", "service": "brain-orchestrator"}


@app.post(
    "/orchestrate",
    response_model=OrchestrationResponse,
    tags=["orchestration"],
    dependencies=[Depends(_verify_internal_key)],
    summary="Orquestar consulta del usuario a través de todos los servicios de IA",
)
async def orchestrate(
    body: OrchestrationRequest,
    orchestrator: IntelligentOrchestrator = Depends(_get_orchestrator),
) -> OrchestrationResponse:
    """Punto de entrada REST del orquestador central.

    Flujo interno:
      1. dialogue-engine → detecta intent y next_step
      2. inference-service → si el intent requiere análisis ML
      3. decision-service → si se ejecutó inferencia
      4. nlg-service → siempre, para generar la respuesta final en texto natural

    Los fallbacks garantizan que siempre retorna una respuesta, incluso si algún
    servicio downstream falla.
    """
    result = await orchestrator.handle_request(
        user_input=body.user_input,
        session_id=body.session_id,
        extra_context=body.context,
    )
    return OrchestrationResponse(**result)
