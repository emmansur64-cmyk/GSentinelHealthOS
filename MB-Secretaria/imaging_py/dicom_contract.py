from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from .types import ImageInput


class DicomContract(ABC):
    @abstractmethod
    def detect_dicom(self, input_data: ImageInput) -> bool:
        raise NotImplementedError

    @abstractmethod
    def extract_safe_metadata(self, input_data: ImageInput) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def normalize_series(self, input_data: ImageInput) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def reject_unsafe(self, input_data: ImageInput) -> dict[str, Any]:
        raise NotImplementedError


def detect_dicom_defensively(input_data: ImageInput) -> bool:
    return input_data.mime_type.lower() == "application/dicom" or bool(input_data.filename and input_data.filename.lower().endswith(".dcm"))


DICOM_CONTRACT_STATUS = {
    "real_dicom_parsing_implemented": False,
    "dependency_added": False,
    "enabled_by_default": False,
}
