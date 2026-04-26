from __future__ import annotations

import hashlib
import logging
from time import perf_counter

from fastapi import APIRouter, Depends, Request

from services.inference_service.app.dependencies import get_inference_engine, get_request_id, require_internal_key
from services.inference_service.app.schemas import HealthResponse
from services.inference_service.app.service import InferenceEngine
from services.shared.contracts import ModelInput, ModelOutput


logger = logging.getLogger("cerebro_ai_med.distributed.inference")
router = APIRouter()


def _anonymize_input(payload: ModelInput) -> dict[str, object]:
    base: dict[str, object] = {
        "source_type": payload.source_type,
        "modality": payload.modality,
    }
    if payload.text:
        text_digest = hashlib.sha256(payload.text.encode("utf-8")).hexdigest()[:12]
        base["text_length"] = len(payload.text)
        base["text_sha256_prefix"] = text_digest
    if payload.image_bytes is not None:
        base["image_bytes"] = payload.image_bytes
    if payload.image_width is not None:
        base["image_width"] = payload.image_width
    if payload.image_height is not None:
        base["image_height"] = payload.image_height
    if payload.image_format is not None:
        base["image_format"] = payload.image_format
    return base


@router.get("/health", response_model=HealthResponse)
def health(engine: InferenceEngine = Depends(get_inference_engine)) -> HealthResponse:
    state = engine.health()
    return HealthResponse(model_loaded=state.model_loaded, model_version=state.model_version)


@router.get("/health/live")
def health_live() -> dict[str, str]:
    return {"status": "ok", "service": "inference-service", "version": "2.0.0"}


@router.post("/infer", response_model=ModelOutput, dependencies=[Depends(require_internal_key)])
def infer_endpoint(payload: ModelInput, request: Request, engine: InferenceEngine = Depends(get_inference_engine)) -> ModelOutput:
    request_id = get_request_id(request)
    started = perf_counter()
    output, model_latency_ms = engine.predict(payload)
    total_latency_ms = (perf_counter() - started) * 1000.0

    logger.info(
        "inference_completed",
        extra={
            "request_id": request_id,
            "input": _anonymize_input(payload),
            "latency_ms": round(total_latency_ms, 3),
            "model_latency_ms": round(model_latency_ms, 3),
            "model_version": output.model_version,
            "model_name": output.model_name,
            "result": {
                "risk_level": output.risk_level,
                "finding_code": output.finding_code,
                "confidence": output.confidence,
            },
        },
    )
    return output
