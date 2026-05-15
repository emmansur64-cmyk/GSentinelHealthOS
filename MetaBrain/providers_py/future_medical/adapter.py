from __future__ import annotations

from MetaBrain.providers_py.provider_health import disabled_provider_health
from MetaBrain.providers_py.provider_response import build_provider_response
from MetaBrain.providers_py.types import ProviderAdapter, ProviderCapabilities, ProviderRequest, ProviderResponse


class DisabledFutureMedicalAdapter(ProviderAdapter):
    def __init__(self) -> None:
        super().__init__(
            provider_name="future-medical",
            model_name="future-medical-disabled",
            capabilities=ProviderCapabilities(True, True, True, True, False, True, 16384, False),
        )

    def complete(self, request: ProviderRequest) -> ProviderResponse:
        return build_provider_response(
            request,
            provider_name="future-medical",
            model_name=self.model_name,
            status="disabled",
            safety_flags=["NO_EXTERNAL_CALL", "NO_MEDICAL_DIAGNOSIS"],
        )

    def healthcheck(self):
        return disabled_provider_health("future-medical")
