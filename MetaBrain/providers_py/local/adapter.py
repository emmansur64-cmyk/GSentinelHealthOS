from __future__ import annotations

from MetaBrain.providers_py.provider_health import disabled_provider_health
from MetaBrain.providers_py.provider_response import build_provider_response
from MetaBrain.providers_py.types import ProviderAdapter, ProviderCapabilities, ProviderRequest, ProviderResponse


class DisabledLocalAdapter(ProviderAdapter):
    def __init__(self) -> None:
        super().__init__(
            provider_name="local",
            model_name="local-disabled",
            capabilities=ProviderCapabilities(True, False, False, False, False, False, 2048, True),
        )

    def complete(self, request: ProviderRequest) -> ProviderResponse:
        return build_provider_response(request, provider_name="local", model_name=self.model_name, status="disabled", safety_flags=["LOCAL_DISABLED"])

    def healthcheck(self):
        return disabled_provider_health("local")
