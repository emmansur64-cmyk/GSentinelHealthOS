"""Stable public error contract for fail-closed Kernel boundaries."""

from dataclasses import dataclass
from enum import StrEnum


class KernelErrorCode(StrEnum):
    INVALID_INPUT = "INVALID_INPUT"
    UNKNOWN_CONCEPT = "UNKNOWN_CONCEPT"
    CONCEPT_KIND_MISMATCH = "CONCEPT_KIND_MISMATCH"
    REVISION_CONFLICT = "REVISION_CONFLICT"
    REVISION_GAP = "REVISION_GAP"
    IDEMPOTENCY_CONFLICT = "IDEMPOTENCY_CONFLICT"
    PERSISTENCE_FAILURE = "PERSISTENCE_FAILURE"


@dataclass(frozen=True, slots=True)
class KernelErrorDetail:
    code: KernelErrorCode
    message: str
    field: str | None = None
    retryable: bool = False


class ClinicalKernelError(Exception):
    def __init__(self, detail: KernelErrorDetail) -> None:
        super().__init__(detail.message)
        self.detail = detail
