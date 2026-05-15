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
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from brain.core.config import settings
from brain.contracts.core_contracts import (
    ContractValidationError,
    default_forbidden_tools_for_mode,
    normalize_assistant_mode,
    validate_runtime_brain_request,
)
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
    assistant_mode: Optional[str] = Field(
        default=None,
        description=(
            "Modo del asistente. Valores: doctor_professional | patient_assistant | "
            "patient_triage | receptionist | administrative | generic_non_clinical. "
            "Si es null o inválido → generic_non_clinical (más restrictivo)."
        ),
    )
    actor_role: Optional[str] = Field(
        default=None,
        description="Rol del actor: doctor | patient | receptionist | admin | system.",
    )
    request_id: Optional[str] = Field(default=None, description="Request ID legacy/opcional.")
    tenant_id: Optional[str] = Field(default=None, description="Tenant ID legacy/opcional.")
    actor_id: Optional[str] = Field(default=None, description="Actor ID legacy/opcional.")
    channel: Optional[str] = Field(default=None, description="Canal runtime (web_chat, whatsapp, api).")
    allowed_tools: Optional[list[str]] = Field(default=None, description="Allowlist opcional de herramientas.")
    forbidden_tools: Optional[list[str]] = Field(default=None, description="Denylist opcional de herramientas.")


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
    assistant_mode: Optional[str] = None
    actor_role: Optional[str] = None
    triage_allowed: Optional[bool] = None


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

BRAIN_ALLOWED_ORIGINS = os.environ.get(
    "BRAIN_ALLOWED_ORIGINS", "http://localhost:3000"
)
origins = [o.strip() for o in BRAIN_ALLOWED_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
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


def _build_orchestrate_contract_payload(body: OrchestrationRequest) -> dict[str, Any]:
    context = body.context or {}
    mode = normalize_assistant_mode(body.assistant_mode or context.get("assistant_mode"))
    actor_role = str(body.actor_role or context.get("actor_role") or "system")

    payload: dict[str, Any] = {
        "request_id": str(body.request_id or context.get("request_id") or uuid4()),
        "tenant_id": str(body.tenant_id or context.get("tenant_id") or "unknown_tenant"),
        "actor_id": str(
            body.actor_id
            or context.get("actor_id")
            or context.get("doctor_id")
            or context.get("patient_id")
            or "unknown_actor"
        ),
        "actor_role": actor_role,
        "assistant_mode": mode,
        "channel": str(body.channel or context.get("channel") or "web_chat"),
        "message": body.user_input,
        "allowed_tools": list(body.allowed_tools or context.get("allowed_tools") or []),
        "forbidden_tools": list(
            body.forbidden_tools
            or context.get("forbidden_tools")
            or default_forbidden_tools_for_mode(mode)
        ),
    }
    return payload


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
    contract_payload = _build_orchestrate_contract_payload(body)
    try:
        validated_mode = validate_runtime_brain_request(contract_payload)
    except ContractValidationError as exc:
        logger.warning(
            "Contract validation blocked /orchestrate request_id=%s mode=%s reason=%s",
            contract_payload.get("request_id"),
            contract_payload.get("assistant_mode"),
            str(exc),
        )
        return OrchestrationResponse(
            message="Solicitud bloqueada por guardas de seguridad del asistente.",
            session_id=body.session_id or f"blocked-{contract_payload['request_id']}",
            metadata=OrchestrationMetadata(
                risk_level="unknown",
                triage_level="none",
                flags=["contract_validation_blocked"],
                confidence=0.0,
                inference_cached=False,
                turn_count=0,
                explanation_count=0,
                request_id=contract_payload["request_id"],
                services_called=["contract_validation"],
                latency_ms=0,
                context_type=None,
                assistant_mode=contract_payload["assistant_mode"],
                actor_role=contract_payload["actor_role"],
                triage_allowed=False,
            ),
        )

    runtime_context = {
        **(body.context or {}),
        "request_id": contract_payload["request_id"],
        "tenant_id": contract_payload["tenant_id"],
        "actor_id": contract_payload["actor_id"],
        "channel": contract_payload["channel"],
        "allowed_tools": contract_payload["allowed_tools"],
        "forbidden_tools": contract_payload["forbidden_tools"],
    }

    result = await orchestrator.handle_request(
        user_input=body.user_input,
        session_id=body.session_id,
        extra_context=runtime_context,
        assistant_mode=validated_mode,
        actor_role=contract_payload["actor_role"],
    )
    return OrchestrationResponse(**result)
