from __future__ import annotations

from .types import ProviderAdapter, ProviderName


class ProviderRegistry:
    def __init__(self) -> None:
        self._providers: dict[ProviderName, ProviderAdapter] = {}

    def register(self, provider: ProviderAdapter) -> None:
        self._providers[provider.provider_name] = provider

    def get(self, name: ProviderName) -> ProviderAdapter | None:
        return self._providers.get(name)

    def list(self) -> list[ProviderAdapter]:
        return list(self._providers.values())
