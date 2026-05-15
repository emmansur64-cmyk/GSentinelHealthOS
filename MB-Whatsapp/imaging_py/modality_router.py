from __future__ import annotations

from typing import Any

from .types import ImageMetadata, ImageModality


def route_image_modality(metadata: ImageMetadata) -> dict[str, Any]:
    if metadata.dicom_detected:
        return {
            "modality": "DICOM",
            "provider_allowed": False,
            "dicom_required": True,
            "requires_human_review": True,
            "route_reason": "dicom_detected_but_disabled_by_default",
        }

    modality = metadata.modality or _mime_to_modality(metadata.mime_type)
    return {
        "modality": modality,
        "provider_allowed": False,
        "dicom_required": False,
        "requires_human_review": True,
        "route_reason": "metadata_only_pipeline",
    }


def _mime_to_modality(mime_type: str) -> ImageModality:
    normalized = mime_type.lower()
    if normalized == "image/png":
        return "PNG"
    if normalized in {"image/jpeg", "image/jpg"}:
        return "JPEG"
    return "UNKNOWN"
