from __future__ import annotations

import logging
from time import perf_counter

from fastapi import APIRouter, Depends, Request

from services.decision_service.app.dependencies import get_decision_engine, get_request_id, require_internal_key
from services.decision_service.app.engine import DecisionEngine
from services.decision_service.app.schemas import DecisionOutput, HealthResponse, ModelOutput


logger = logging.getLogger("cerebro_ai_med.distributed.decision")
router = APIRouter()


def _summarize_input(payload: ModelOutput) -> dict[str, object]:
    return {
        "model_name": payload.model_name,
        "model_version": payload.model_version,
        "risk_level": payload.risk_level,
        "confidence": round(payload.confidence, 4),
        "high_probability": round(payload.probabilities.get("high", 0.0), 4),
        "features_count": len(payload.features_used),
    }


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse()


@router.get("/health/live")
def health_live() -> dict[str, str]:
    return {"status": "ok", "service": "decision_service"}


@router.post("/decide", response_model=DecisionOutput, dependencies=[Depends(require_internal_key)])
def decide(payload: ModelOutput, request: Request, engine: DecisionEngine = Depends(get_decision_engine)) -> DecisionOutput:
    request_id = get_request_id(request)
    started = perf_counter()
    decision = engine.decide(payload)
    latency_ms = (perf_counter() - started) * 1000.0

    logger.info(
        "decision_generated",
        extra={
            "request_id": request_id,
            "input": _summarize_input(payload),
            "decision": decision.model_dump(mode="json"),
            "latency_ms": round(latency_ms, 3),
        },
    )
    return decision
