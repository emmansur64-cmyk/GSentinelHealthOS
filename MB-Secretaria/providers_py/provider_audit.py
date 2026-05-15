from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from .types import ProviderRequest, ProviderResponse


@dataclass(frozen=True)
class ProviderAuditEvent:
    trace_id: str
    provider: str
    model: str
    request_type: str
    modality: str
    latency_ms: int
    timeout: bool
    fallback_used: bool
    retry_count: int
    phi_detected: bool
    blocked_by_policy: bool
    created_at: str


def build_provider_audit_event(
    request: ProviderRequest,
    response: ProviderResponse,
    *,
    timeout: bool = False,
    phi_detected: bool = False,
    blocked_by_policy: bool = False,
) -> ProviderAuditEvent:
    return ProviderAuditEvent(
        trace_id=request.trace_id,
        provider=response.provider_name,
        model=response.model_name,
        request_type=request.request_type,
        modality=request.modality,
        latency_ms=response.latency_ms,
        timeout=timeout,
        fallback_used=response.fallback_used,
        retry_count=response.retry_count,
        phi_detected=phi_detected,
        blocked_by_policy=blocked_by_policy,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
