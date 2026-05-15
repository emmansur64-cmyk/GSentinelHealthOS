from __future__ import annotations

from datetime import datetime, timezone

from .types import ProviderHealth, ProviderName


def disabled_provider_health(provider_name: ProviderName) -> ProviderHealth:
    return ProviderHealth(
        provider_name=provider_name,
        status="disabled",
        latency_ms=0,
        error_rate=0.0,
        timeout_rate=0.0,
        degraded_mode=True,
        checked_at=datetime.now(timezone.utc).isoformat(),
    )
