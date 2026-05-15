from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Mapping

from .domain_guard import DOMAIN_NAME

PROVIDER_API_KEY_ENV = "GROQ_API_KEY_WHATSAPP"
PROVIDER_MODEL_ENV = "GROQ_MODEL_WHATSAPP"


@dataclass(frozen=True)
class ProviderConfig:
    domain: str
    api_key_env: str
    model_env: str
    api_key_configured: bool
    model: str | None


def load_provider_config(environ: Mapping[str, str] | None = None) -> ProviderConfig:
    source = environ if environ is not None else os.environ
    api_key = source.get(PROVIDER_API_KEY_ENV, "").strip()
    model = source.get(PROVIDER_MODEL_ENV, "").strip() or None
    return ProviderConfig(
        domain=DOMAIN_NAME,
        api_key_env=PROVIDER_API_KEY_ENV,
        model_env=PROVIDER_MODEL_ENV,
        api_key_configured=bool(api_key),
        model=model,
    )
