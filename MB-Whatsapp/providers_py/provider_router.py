from __future__ import annotations

from .context_sanitizer import sanitize_provider_request
from .provider_fallback import build_safe_provider_fallback
from .provider_flags import load_provider_flags
from .types import ProviderAdapter, ProviderFlags, ProviderRequest, ProviderResponse


class ProviderRouter:
    def __init__(self, providers: list[ProviderAdapter], flags: ProviderFlags | None = None) -> None:
        self.providers = providers
        self.flags = flags or load_provider_flags()

    def route(self, request: ProviderRequest) -> ProviderResponse:
        sanitized = sanitize_provider_request(request, self.flags.phi_allowed)
        safe_request = sanitized["request"]
        if not self.flags.router_enabled:
            return build_safe_provider_fallback(safe_request, "ROUTER_DISABLED")
        if self.flags.shadow_mode:
            return build_safe_provider_fallback(safe_request, "SHADOW_MODE")
        if sanitized["blocked_by_policy"]:
            return build_safe_provider_fallback(safe_request, "PHI_BLOCKED")
        if request.modality == "multimodal" and not self.flags.multimodal_enabled:
            return build_safe_provider_fallback(safe_request, "MULTIMODAL_DISABLED")
        if request.image_reference and not self.flags.external_image_enabled:
            return build_safe_provider_fallback(safe_request, "EXTERNAL_IMAGE_DISABLED")
        return build_safe_provider_fallback(safe_request, "NO_RUNTIME_PROVIDER_SELECTED")
