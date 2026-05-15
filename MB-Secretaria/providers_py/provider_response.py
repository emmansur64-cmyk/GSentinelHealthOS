from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any

from .types import ProviderRequest, ProviderResponse


def build_provider_audit_ref(request: ProviderRequest) -> str:
    payload = f"{request.trace_id}:{request.tenant_id}:{request.request_type}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def build_provider_response(
    request: ProviderRequest,
    *,
    provider_name: str = "none",
    model_name: str = "none",
    status: str = "fallback",
    content: str = "",
    latency_ms: int = 0,
    structured_output: Any = None,
    confidence_score: float | None = None,
    safety_flags: list[str] | None = None,
    fallback_used: bool = False,
    retry_count: int = 0,
) -> ProviderResponse:
    return ProviderResponse(
        trace_id=request.trace_id,
        provider_name=provider_name,
        model_name=model_name,
        latency_ms=latency_ms,
        status=status,
        content=content,
        structured_output=structured_output,
        confidence_score=confidence_score,
        safety_flags=safety_flags or [],
        fallback_used=fallback_used,
        retry_count=retry_count,
        audit_ref=build_provider_audit_ref(request),
        created_at=datetime.now(timezone.utc).isoformat(),
    )
