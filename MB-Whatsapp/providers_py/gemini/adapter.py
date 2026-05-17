from __future__ import annotations

from ..provider_health import disabled_provider_health
from ..provider_response import build_provider_response
from ..types import ProviderAdapter, ProviderCapabilities, ProviderRequest, ProviderResponse


class DisabledGeminiAdapter(ProviderAdapter):
    def __init__(self) -> None:
        super().__init__(
            provider_name="gemini",
            model_name="gemini-disabled",
            capabilities=ProviderCapabilities(True, False, False, True, False, False, 8192, False),
        )

    def complete(self, request: ProviderRequest) -> ProviderResponse:
        return build_provider_response(request, provider_name="gemini", model_name=self.model_name, status="disabled", safety_flags=["NO_EXTERNAL_CALL"])

    def healthcheck(self):
        return disabled_provider_health("gemini")
