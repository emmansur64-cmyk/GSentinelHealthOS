from __future__ import annotations

from typing import Any

from .types import ImageMetadata


def calculate_metadata_only_confidence(metadata: ImageMetadata) -> dict[str, Any]:
    missing_core = not metadata.width or not metadata.height or not metadata.pixels_million or not metadata.bytes_per_pixel
    quality_penalty = min(len(metadata.image_quality_flags) * 0.08, 0.24)
    confidence = max(0.1, 0.35 - quality_penalty - (0.12 if missing_core else 0))
    uncertainty = min(0.95, 0.75 + quality_penalty + (0.1 if missing_core else 0))

    return {
        "confidence_score": round(confidence, 3),
        "uncertainty_score": round(uncertainty, 3),
        "risk_level": "medium" if metadata.image_quality_flags else "unknown",
        "requires_human_review": True,
        "human_review_reason": "metadata_only_no_visual_diagnosis",
        "safe_to_display": True,
    }
