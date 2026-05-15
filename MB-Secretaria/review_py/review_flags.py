from __future__ import annotations

import os
from collections.abc import Mapping

from .types import HumanReviewFlags


def _read_bool(env: Mapping[str, str], name: str, fallback: bool) -> bool:
    value = env.get(name)
    if value is None:
        return fallback
    return value.strip().lower() == "true"


def load_human_review_flags(env: Mapping[str, str] | None = None) -> HumanReviewFlags:
    source = env or os.environ
    return HumanReviewFlags(
        enabled=_read_bool(source, "HUMAN_REVIEW_ENABLED", False),
        shadow_mode=_read_bool(source, "HUMAN_REVIEW_SHADOW_MODE", True),
        blocking_enabled=_read_bool(source, "HUMAN_REVIEW_BLOCKING_ENABLED", False),
        image_required=_read_bool(source, "HUMAN_REVIEW_IMAGE_REQUIRED", True),
        low_confidence_required=_read_bool(source, "HUMAN_REVIEW_LOW_CONFIDENCE_REQUIRED", True),
        multimodal_required=_read_bool(source, "HUMAN_REVIEW_MULTIMODAL_REQUIRED", True),
        high_risk_required=_read_bool(source, "HUMAN_REVIEW_HIGH_RISK_REQUIRED", True),
        override_enabled=_read_bool(source, "HUMAN_OVERRIDE_ENABLED", False),
    )
