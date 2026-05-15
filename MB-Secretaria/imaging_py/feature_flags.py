from __future__ import annotations

import os
from typing import Optional

from .types import ImageFeatureFlags


def _read_bool(value: Optional[str], fallback: bool) -> bool:
    if value is None:
        return fallback
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return fallback


def load_image_feature_flags(env: dict[str, str] | None = None) -> ImageFeatureFlags:
    values = env if env is not None else os.environ
    return ImageFeatureFlags(
        medical_vision_enabled=_read_bool(values.get("MEDICAL_VISION_ENABLED"), False),
        medical_vision_shadow_mode=_read_bool(values.get("MEDICAL_VISION_SHADOW_MODE"), True),
        medical_vision_provider_enabled=_read_bool(values.get("MEDICAL_VISION_PROVIDER_ENABLED"), False),
        dicom_enabled=_read_bool(values.get("DICOM_ENABLED"), False),
        dicom_shadow_mode=_read_bool(values.get("DICOM_SHADOW_MODE"), True),
        image_human_review_required=_read_bool(values.get("IMAGE_HUMAN_REVIEW_REQUIRED"), True),
        image_store_original=_read_bool(values.get("IMAGE_STORE_ORIGINAL"), False),
    )
