from __future__ import annotations

from typing import Any

from .types import ImageInput


SUPPORTED_MIME_TYPES = {"image/png", "image/jpeg", "image/jpg", "application/dicom"}


def ingest_image_input(input_data: ImageInput) -> dict[str, Any]:
    safety_notes: list[str] = []

    if not input_data.trace_id or not input_data.tenant_id or not input_data.doctor_id:
        return {"accepted": False, "rejection_reason": "missing_trace_or_scope", "safety_notes": safety_notes}

    if input_data.mime_type.lower() not in SUPPORTED_MIME_TYPES:
        return {"accepted": False, "rejection_reason": "unsupported_mime_type", "safety_notes": safety_notes}

    if input_data.bytes_size <= 0:
        return {"accepted": False, "rejection_reason": "invalid_bytes_size", "safety_notes": safety_notes}

    if not input_data.image_base64 and not input_data.raw_bytes and not input_data.metadata:
        return {"accepted": False, "rejection_reason": "missing_image_payload_or_metadata", "safety_notes": safety_notes}

    if input_data.image_base64 or input_data.raw_bytes:
        safety_notes.append("original_image_not_stored_by_default")

    return {"accepted": True, "input": input_data, "safety_notes": safety_notes}
