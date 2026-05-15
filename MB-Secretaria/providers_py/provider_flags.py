from __future__ import annotations

import os
from typing import Optional

from .types import ProviderFlags


def _read_bool(value: Optional[str], fallback: bool) -> bool:
    if value is None:
        return fallback
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return fallback


def load_provider_flags(env: dict[str, str] | None = None) -> ProviderFlags:
    values = env if env is not None else os.environ
    return ProviderFlags(
        router_enabled=_read_bool(values.get("LLM_PROVIDER_ROUTER_ENABLED"), False),
        shadow_mode=_read_bool(values.get("LLM_PROVIDER_SHADOW_MODE"), True),
        fallback_enabled=_read_bool(values.get("LLM_PROVIDER_FALLBACK_ENABLED"), False),
        healthcheck_enabled=_read_bool(values.get("LLM_PROVIDER_HEALTHCHECK_ENABLED"), True),
        structured_output_enabled=_read_bool(values.get("LLM_PROVIDER_STRUCTURED_OUTPUT_ENABLED"), False),
        multimodal_enabled=_read_bool(values.get("LLM_PROVIDER_MULTIMODAL_ENABLED"), False),
        external_image_enabled=_read_bool(values.get("LLM_PROVIDER_EXTERNAL_IMAGE_ENABLED"), False),
        phi_allowed=_read_bool(values.get("LLM_PROVIDER_PHI_ALLOWED"), False),
    )
