from __future__ import annotations

from .provider_response import build_provider_response
from .types import ProviderRequest, ProviderResponse


def build_safe_provider_fallback(request: ProviderRequest, reason: str, retry_count: int = 0) -> ProviderResponse:
    return build_provider_response(
        request,
        provider_name="none",
        model_name="safe-fallback",
        status="fallback",
        safety_flags=["SAFE_FALLBACK", reason],
        fallback_used=True,
        retry_count=retry_count,
    )
