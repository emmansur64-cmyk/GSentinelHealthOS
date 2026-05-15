from __future__ import annotations

import os
from collections.abc import Mapping

from .types import ClinicalConfidenceFlags


def _read_bool(env: Mapping[str, str], name: str, fallback: bool) -> bool:
    value = env.get(name)
    if value is None:
        return fallback
    return value.strip().lower() == "true"


def load_clinical_confidence_flags(env: Mapping[str, str] | None = None) -> ClinicalConfidenceFlags:
    source = env or os.environ
    return ClinicalConfidenceFlags(
        enabled=_read_bool(source, "CLINICAL_CONFIDENCE_ENABLED", False),
        shadow_mode=_read_bool(source, "CLINICAL_CONFIDENCE_SHADOW_MODE", True),
        blocking_enabled=_read_bool(source, "CLINICAL_CONFIDENCE_BLOCKING_ENABLED", False),
        multimodal_enabled=_read_bool(source, "CLINICAL_CONFIDENCE_MULTIMODAL_ENABLED", False),
        provider_consistency_enabled=_read_bool(source, "CLINICAL_CONFIDENCE_PROVIDER_CONSISTENCY_ENABLED", True),
        hallucination_check_enabled=_read_bool(source, "CLINICAL_CONFIDENCE_HALLUCINATION_CHECK_ENABLED", True),
        safe_display_enabled=_read_bool(source, "CLINICAL_CONFIDENCE_SAFE_DISPLAY_ENABLED", False),
        auto_escalation_enabled=_read_bool(source, "CLINICAL_CONFIDENCE_AUTO_ESCALATION_ENABLED", False),
    )
