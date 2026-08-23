"""Versioned Kernel-owned execution policy."""

from collections.abc import Mapping
from dataclasses import dataclass
from types import MappingProxyType

from .contracts import Capability, RequestKind


@dataclass(frozen=True, slots=True)
class KernelPolicy:
    version: str
    capabilities_by_request: Mapping[RequestKind, frozenset[Capability]]

    def __post_init__(self) -> None:
        if not self.version.strip():
            raise ValueError("policy version is required")
        object.__setattr__(
            self,
            "capabilities_by_request",
            MappingProxyType(dict(self.capabilities_by_request)),
        )
        missing = set(RequestKind) - set(self.capabilities_by_request)
        if missing:
            raise ValueError(f"policy does not govern request kinds: {sorted(item.value for item in missing)}")

    def capabilities_for(self, kind: RequestKind) -> frozenset[Capability]:
        return self.capabilities_by_request[kind]


DEFAULT_PHASE1_POLICY = KernelPolicy(
    version="kernel-policy/phase1-v1",
    capabilities_by_request={
        RequestKind.PATIENT_CASE: frozenset(
            {Capability.MANAGEMENT, Capability.CONFIDENCE, Capability.UNCERTAINTY, Capability.EXPLAINABILITY}
        ),
        RequestKind.CASE_REASSESSMENT: frozenset(
            {Capability.MANAGEMENT, Capability.CONFIDENCE, Capability.UNCERTAINTY, Capability.EXPLAINABILITY}
        ),
        RequestKind.CASE_EXPLANATION: frozenset({Capability.EXPLAINABILITY}),
    },
)
