"""FastAPI routes for NLG service."""

from __future__ import annotations

import logging
import os
import time
from uuid import uuid4

from fastapi import APIRouter, Header, HTTPException, Request

from services.nlg_service.app.engine import NLGEngine, NLGEngineError
from services.nlg_service.app.schemas import (
    HealthResponse,
    NLGGenerateRequest,
    NLGGenerateResponse,
    LLMStatusResponse,
    ErrorResponse,
)


logger = logging.getLogger(__name__)
router = APIRouter()

# Global engine instance
_engine = NLGEngine()


def get_llm_status_snapshot() -> dict[str, object]:
    """Expose a non-HTTP snapshot for startup diagnostics."""
    return _engine.llm_status()


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(
        status="ok",
        service="nlg-service",
        version="1.0.0"
    )


@router.post("/generate", response_model=NLGGenerateResponse)
async def generate(
    payload: NLGGenerateRequest,
    request: Request,
) -> NLGGenerateResponse:
    """
    Generate natural language message.

    Takes:
    - decision_output: DecisionOutput from decision-service
    - model_output: ModelOutput from inference-service
    - dialogue_action: (optional) DialogueAction from dialogue-engine
    - symptoms: (optional) List of symptom codes

    Returns:
    - message: Natural language text
    - style: "clinical" or "conversational"
    - variants_used: List of template variants
    - disclaimers: Safety disclaimers included
    """
    request_id = getattr(request.state, "request_id", str(uuid4()))
    start_time = time.perf_counter()

    try:
        logger.info(
            "generate_request_received",
            extra={
                "request_id": request_id,
                "risk_level": payload.decision_output.risk_level,
                "model": payload.model_output.model_name,
            }
        )

        # Extract dialogue intent from dialogue_action if provided
        dialogue_intent = "default"
        if payload.dialogue_action:
            dialogue_intent = payload.dialogue_action.get("intent", "default")

        patient_context = dict(payload.patient_context)
        if payload.conversation_history:
            patient_context["conversation_history"] = payload.conversation_history

        # Generate message
        result = _engine.generate(
            decision_output=payload.decision_output,
            model_output=payload.model_output,
            dialogue_intent=dialogue_intent,
            symptoms=payload.symptoms,
            patient_context=patient_context,
        )

        latency_ms = (time.perf_counter() - start_time) * 1000

        logger.info(
            "message_generated",
            extra={
                "request_id": request_id,
                "latency_ms": latency_ms,
                "message_length": len(result["message"]),
                "variants_count": len(result["variants_used"]),
            }
        )

        return NLGGenerateResponse(
            message=result["message"],
            style=result["style"],
            variants_used=result["variants_used"],
            disclaimers=result["disclaimers"],
            metadata=result.get("metadata", {}),
        )

    except NLGEngineError as e:
        latency_ms = (time.perf_counter() - start_time) * 1000

        logger.warning(
            "nlg_error",
            extra={
                "request_id": request_id,
                "code": e.code,
                "message": e.message,
                "latency_ms": latency_ms,
            }
        )

        # Error will be handled by FastAPI exception handler
        raise

    except Exception as e:
        latency_ms = (time.perf_counter() - start_time) * 1000

        logger.error(
            "unexpected_error",
            extra={
                "request_id": request_id,
                "error": str(e),
                "error_type": type(e).__name__,
                "latency_ms": latency_ms,
            }
        )

        raise NLGEngineError(
            code="internal_error",
            message="Error inesperado al generar mensaje",
            status_code=500,
        )


@router.get("/internal/diagnostics/llm-status", response_model=LLMStatusResponse)
async def llm_status(
    x_internal_token: str | None = Header(default=None, alias="X-Internal-Token"),
) -> LLMStatusResponse:
    """Internal-only endpoint to verify Groq vs deterministic mode."""
    diagnostics_enabled = os.getenv("NLG_INTERNAL_DIAGNOSTICS_ENABLED", "false").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    if not diagnostics_enabled:
        raise HTTPException(status_code=404, detail="Not Found")

    required_token = os.getenv("NLG_INTERNAL_DIAGNOSTICS_TOKEN", "").strip()
    if required_token and x_internal_token != required_token:
        raise HTTPException(status_code=403, detail="Forbidden")

    status = _engine.llm_status()
    return LLMStatusResponse.model_validate(status)
