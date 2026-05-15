from __future__ import annotations

import re
from typing import Any, Optional, cast

from .types import ImageInput, ImageMetadata, ImageModality


SENSITIVE_METADATA_KEYS = ("patient", "name", "email", "phone", "address", "token", "secret", "gps", "latitude", "longitude")


def sanitize_image_metadata(metadata: dict[str, Any] | None = None) -> dict[str, Any]:
    sanitized: dict[str, Any] = {}
    for key, value in (metadata or {}).items():
        normalized = key.lower()
        if any(sensitive in normalized for sensitive in SENSITIVE_METADATA_KEYS):
            sanitized[key] = "[REDACTED_METADATA]"
        elif isinstance(value, str):
            sanitized[key] = re.sub(r"<[^>]*>", "", value)[:500]
        else:
            sanitized[key] = value
    return sanitized


def extract_image_metadata(input_data: ImageInput) -> ImageMetadata:
    metadata = sanitize_image_metadata(input_data.metadata)
    width = _int_value(metadata.get("width") or metadata.get("image_width"))
    height = _int_value(metadata.get("height") or metadata.get("image_height"))
    pixels_million = round((width * height) / 1_000_000, 6) if width and height else _float_value(metadata.get("pixels_million"))
    aspect_ratio = round(width / max(height, 1), 6) if width and height else _float_value(metadata.get("aspect_ratio"))
    bytes_per_pixel = (
        round(input_data.bytes_size / max(float(width * height), 1.0), 8)
        if width and height
        else _float_value(metadata.get("bytes_per_pixel"))
    )

    return ImageMetadata(
        mime_type=input_data.mime_type,
        width=width,
        height=height,
        aspect_ratio=aspect_ratio,
        pixels_million=pixels_million,
        bytes_per_pixel=bytes_per_pixel,
        modality=_normalize_modality(metadata.get("modality")),
        dicom_detected=_detect_dicom(input_data),
        image_quality_flags=_quality_flags(width, height, input_data.bytes_size, bytes_per_pixel),
        sanitized_metadata=metadata,
    )


def _detect_dicom(input_data: ImageInput) -> bool:
    return input_data.mime_type.lower() == "application/dicom" or bool(input_data.filename and input_data.filename.lower().endswith(".dcm"))


def _quality_flags(width: Optional[int], height: Optional[int], bytes_size: int, bytes_per_pixel: Optional[float]) -> list[str]:
    flags: list[str] = []
    if not width or not height:
        flags.append("missing_dimensions")
    if width and height and width * height < 250_000:
        flags.append("low_pixel_count")
    if bytes_size > 15 * 1024 * 1024:
        flags.append("large_payload")
    if bytes_per_pixel is not None and bytes_per_pixel < 0.15:
        flags.append("low_bytes_per_pixel")
    return flags


def _normalize_modality(value: Any) -> Optional[ImageModality]:
    if not isinstance(value, str):
        return None
    normalized = value.upper()
    if normalized in {"TEXT", "XRAY", "CT", "MRI", "DICOM", "PNG", "JPG", "JPEG", "UNKNOWN"}:
        return cast(ImageModality, normalized)
    return "UNKNOWN"


def _int_value(value: Any) -> Optional[int]:
    return value if isinstance(value, int) and value > 0 else None


def _float_value(value: Any) -> Optional[float]:
    return value if isinstance(value, float) or isinstance(value, int) else None
