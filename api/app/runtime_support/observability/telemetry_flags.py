from __future__ import annotations

import os
from collections.abc import Mapping

from .types import ObservabilityFlags


def _read_bool(env: Mapping[str, str], name: str, fallback: bool) -> bool:
    value = env.get(name)
    if value is None:
        return fallback
    return value.strip().lower() == "true"


def load_observability_flags(env: Mapping[str, str] | None = None) -> ObservabilityFlags:
    source = env or os.environ
    return ObservabilityFlags(
        enabled=_read_bool(source, "OBSERVABILITY_ENABLED", False),
        shadow_mode=_read_bool(source, "OBSERVABILITY_SHADOW_MODE", True),
        structured_logging_enabled=_read_bool(source, "OBSERVABILITY_STRUCTURED_LOGGING_ENABLED", False),
        trace_engine_enabled=_read_bool(source, "OBSERVABILITY_TRACE_ENGINE_ENABLED", False),
        provider_metrics_enabled=_read_bool(source, "OBSERVABILITY_PROVIDER_METRICS_ENABLED", False),
        confidence_metrics_enabled=_read_bool(source, "OBSERVABILITY_CONFIDENCE_METRICS_ENABLED", False),
        review_metrics_enabled=_read_bool(source, "OBSERVABILITY_REVIEW_METRICS_ENABLED", False),
        multimodal_metrics_enabled=_read_bool(source, "OBSERVABILITY_MULTIMODAL_METRICS_ENABLED", False),
        external_export_enabled=_read_bool(source, "OBSERVABILITY_EXTERNAL_EXPORT_ENABLED", False),
        phi_allowed=_read_bool(source, "OBSERVABILITY_PHI_ALLOWED", False),
    )
