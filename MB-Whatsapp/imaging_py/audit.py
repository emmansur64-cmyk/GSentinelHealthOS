from __future__ import annotations

import hashlib

from .types import ImageAnalysisResult, ImageAuditEvent, ImageInput, ImageModality


def build_image_audit_ref(input_data: ImageInput) -> str:
    payload = f"{input_data.trace_id}:{input_data.tenant_id}:{input_data.doctor_id}:{input_data.bytes_size}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def build_image_audit_event(input_data: ImageInput, result: ImageAnalysisResult, modality: ImageModality) -> ImageAuditEvent:
    return ImageAuditEvent(
        trace_id=input_data.trace_id,
        tenant_id=input_data.tenant_id,
        doctor_id=input_data.doctor_id,
        patient_id=input_data.patient_id,
        source=input_data.source,
        modality=modality,
        provider=result.provider,
        confidence_score=result.confidence_score,
        uncertainty_score=result.uncertainty_score,
        requires_human_review=result.requires_human_review,
        no_definitive_diagnosis=result.no_definitive_diagnosis,
        created_at=result.created_at,
    )
