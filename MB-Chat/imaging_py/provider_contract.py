from __future__ import annotations

from abc import ABC, abstractmethod

from .types import ImageAnalysisResult, ImageInput, ImageModality


class ImageProvider(ABC):
    provider_name: str

    @abstractmethod
    def analyze(self, input_data: ImageInput) -> ImageAnalysisResult:
        raise NotImplementedError

    @abstractmethod
    def healthcheck(self) -> dict[str, object]:
        raise NotImplementedError

    @abstractmethod
    def supports_modality(self, modality: ImageModality) -> bool:
        raise NotImplementedError


IMAGE_PROVIDER_CONTRACT_STATUS = {
    "implemented_providers": [],
    "enabled_by_default": False,
    "external_calls_allowed_in_phase_4": False,
}
