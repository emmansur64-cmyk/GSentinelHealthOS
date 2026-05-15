from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request

from cerebro_ai_med.api.observability import anonymize_text, record_inference_metrics
from cerebro_ai_med.api.schemas import AnalyzeResponse, ImageSummary, JointDecisionInfo, MedicalAuditInfo, ModelInference, PipelineInfo, TextSummary
from cerebro_ai_med.api.validators import (
    decode_base64_image,
    parse_form_modality,
    parse_json_input,
    sanitize_text_input,
    validate_image_bytes,
)
from cerebro_ai_med.decision import HybridDecisionOrchestrator
from cerebro_ai_med.api.security import require_api_key
from cerebro_ai_med.models import ModelInput, get_model_service


logger = logging.getLogger("cerebro_ai_med.api")
router = APIRouter(dependencies=[Depends(require_api_key)])
model_service = get_model_service()
decision_orchestrator = HybridDecisionOrchestrator()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _build_medical_audit(risk_level: str) -> MedicalAuditInfo:
    safe_recommendations = {
        "low": "Seguimiento clinico y reevaluacion medica si hay progresion de sintomas.",
        "medium": "Se recomienda evaluacion medica prioritaria para confirmacion diagnostica.",
        "high": "Buscar evaluacion medica urgente de forma inmediata.",
    }
    return MedicalAuditInfo(
        no_definitive_diagnosis=True,
        risk_level=risk_level,
        safe_recommendation=safe_recommendations[risk_level],
        requires_medical_evaluation=True,
    )


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: Request) -> AnalyzeResponse:
    content_type = (request.headers.get("content-type") or "").lower()
    client_host = request.client.host if request.client else "unknown"
    request_id = getattr(request.state, "request_id", "unknown")
    logger.info(
        "request_received",
        extra={
            "request_id": request_id,
            "path": "/analyze",
            "content_type": content_type,
            "client": client_host,
        },
    )

    try:
        if "application/json" in content_type:
            body = await request.json()
            payload = parse_json_input(body)

            if payload.input_type == "text":
                started = time.perf_counter()
                text_clean = sanitize_text_input(payload.text)
                model_output = model_service.predict(
                    ModelInput(
                        source_type="text",
                        modality=payload.modality,
                        text=text_clean,
                    )
                )
                joint_decision = decision_orchestrator.decide(
                    model_output=model_output.model_dump(),
                    modality=payload.modality,
                    input_text=text_clean,
                    patient_context={"modality": payload.modality},
                )

                response = AnalyzeResponse(
                    status="accepted",
                    timestamp_utc=_utc_now(),
                    input={
                        "type": "text",
                        "modality": payload.modality,
                        "summary": TextSummary(
                            text_length=len(text_clean),
                            preview=text_clean[:100],
                        ),
                    },
                    pipeline=PipelineInfo(
                        step="api_base",
                        next_step="models_baseline",
                        message="Entrada de texto validada correctamente",
                    ),
                    inference=ModelInference(**model_output.model_dump()),
                    joint_decision=JointDecisionInfo(**joint_decision),
                    medical_audit=_build_medical_audit(model_output.risk_level),
                )
                elapsed = time.perf_counter() - started
                record_inference_metrics("text", model_output.model_version, model_output.risk_level, elapsed)
                logger.info(
                    "request_processed",
                    extra={
                        "request_id": request_id,
                        "input": {
                            "type": "text",
                            "modality": payload.modality,
                            "summary": anonymize_text(text_clean),
                        },
                        "output": {
                            "risk_level": model_output.risk_level,
                            "confidence": model_output.confidence,
                            "recommendation_code": model_output.recommendation_code,
                        },
                        "model": {
                            "name": model_output.model_name,
                            "version": model_output.model_version,
                        },
                        "latency_ms": round(elapsed * 1000.0, 4),
                    },
                )
                return response

            started = time.perf_counter()
            image_bytes = decode_base64_image(payload.image_base64)
            image_meta = validate_image_bytes(image_bytes)
            model_output = model_service.predict(
                ModelInput(
                    source_type="image",
                    modality=payload.modality,
                    image_bytes=len(image_bytes),
                    image_width=image_meta.width,
                    image_height=image_meta.height,
                    image_format=image_meta.image_format,
                )
            )
            joint_decision = decision_orchestrator.decide(
                model_output=model_output.model_dump(),
                modality=payload.modality,
                input_text=None,
                patient_context={"modality": payload.modality},
            )

            response = AnalyzeResponse(
                status="accepted",
                timestamp_utc=_utc_now(),
                input={
                    "type": "image",
                    "modality": payload.modality,
                    "summary": ImageSummary(
                        bytes=len(image_bytes),
                        format=image_meta.image_format,
                        width=image_meta.width,
                        height=image_meta.height,
                    ),
                },
                pipeline=PipelineInfo(
                    step="api_base",
                    next_step="models_baseline",
                    message="Entrada de imagen validada correctamente",
                ),
                inference=ModelInference(**model_output.model_dump()),
                joint_decision=JointDecisionInfo(**joint_decision),
                medical_audit=_build_medical_audit(model_output.risk_level),
            )
            elapsed = time.perf_counter() - started
            record_inference_metrics("image", model_output.model_version, model_output.risk_level, elapsed)
            logger.info(
                "request_processed",
                extra={
                    "request_id": request_id,
                    "input": {
                        "type": "image",
                        "modality": payload.modality,
                        "summary": {
                            "image_bytes": len(image_bytes),
                            "image_format": image_meta.image_format,
                            "image_width": image_meta.width,
                            "image_height": image_meta.height,
                        },
                    },
                    "output": {
                        "risk_level": model_output.risk_level,
                        "confidence": model_output.confidence,
                        "recommendation_code": model_output.recommendation_code,
                    },
                    "model": {
                        "name": model_output.model_name,
                        "version": model_output.model_version,
                    },
                    "latency_ms": round(elapsed * 1000.0, 4),
                },
            )
            return response

        if "multipart/form-data" in content_type:
            form = await request.form()
            upload = form.get("image")
            if upload is None or not hasattr(upload, "read"):
                raise HTTPException(status_code=400, detail="image_file_is_required")

            form_input = parse_form_modality(form.get("modality"))
            started = time.perf_counter()
            image_bytes = await upload.read()
            image_meta = validate_image_bytes(image_bytes)
            model_output = model_service.predict(
                ModelInput(
                    source_type="image",
                    modality=form_input.modality,
                    image_bytes=len(image_bytes),
                    image_width=image_meta.width,
                    image_height=image_meta.height,
                    image_format=image_meta.image_format,
                )
            )
            joint_decision = decision_orchestrator.decide(
                model_output=model_output.model_dump(),
                modality=form_input.modality,
                input_text=None,
                patient_context={"modality": form_input.modality},
            )

            response = AnalyzeResponse(
                status="accepted",
                timestamp_utc=_utc_now(),
                input={
                    "type": "image",
                    "modality": form_input.modality,
                    "summary": ImageSummary(
                        bytes=len(image_bytes),
                        format=image_meta.image_format,
                        width=image_meta.width,
                        height=image_meta.height,
                    ),
                },
                pipeline=PipelineInfo(
                    step="api_base",
                    next_step="models_baseline",
                    message="Imagen multipart validada correctamente",
                ),
                inference=ModelInference(**model_output.model_dump()),
                joint_decision=JointDecisionInfo(**joint_decision),
                medical_audit=_build_medical_audit(model_output.risk_level),
            )
            elapsed = time.perf_counter() - started
            record_inference_metrics("image", model_output.model_version, model_output.risk_level, elapsed)
            logger.info(
                "request_processed",
                extra={
                    "request_id": request_id,
                    "input": {
                        "type": "image_multipart",
                        "modality": form_input.modality,
                        "summary": {
                            "image_bytes": len(image_bytes),
                            "image_format": image_meta.image_format,
                            "image_width": image_meta.width,
                            "image_height": image_meta.height,
                        },
                    },
                    "output": {
                        "risk_level": model_output.risk_level,
                        "confidence": model_output.confidence,
                        "recommendation_code": model_output.recommendation_code,
                    },
                    "model": {
                        "name": model_output.model_name,
                        "version": model_output.model_version,
                    },
                    "latency_ms": round(elapsed * 1000.0, 4),
                },
            )
            return response

        raise HTTPException(
            status_code=415,
            detail="content_type_must_be_application_json_or_multipart_form_data",
        )
    except HTTPException:
        logger.error("request_failed", extra={"request_id": request_id, "path": "/analyze"}, exc_info=True)
        raise
    except (RuntimeError, ValueError):
        logger.error("model_runtime_failure", extra={"request_id": request_id, "path": "/analyze"}, exc_info=True)
        raise HTTPException(status_code=503, detail="inference_unavailable")