"""Phase-0 contracts. These carry no medical rules or free-form authority."""

from collections.abc import Mapping
from dataclasses import dataclass, field
from enum import StrEnum
from types import MappingProxyType


class RequestKind(StrEnum):
    PATIENT_CASE = "PATIENT_CASE"
    CASE_REASSESSMENT = "CASE_REASSESSMENT"
    CASE_EXPLANATION = "CASE_EXPLANATION"


class Capability(StrEnum):
    REASONING = "REASONING"
    EVIDENCE_EVALUATION = "EVIDENCE_EVALUATION"
    DIAGNOSTIC_RANKING = "DIAGNOSTIC_RANKING"
    PATHOPHYSIOLOGY = "PATHOPHYSIOLOGY"
    COMPLICATIONS = "COMPLICATIONS"
    EVIDENCE_SYNTHESIS = "EVIDENCE_SYNTHESIS"
    CONSTRAINTS = "CONSTRAINTS"
    MANAGEMENT = "MANAGEMENT"
    CONFIDENCE = "CONFIDENCE"
    UNCERTAINTY = "UNCERTAINTY"
    EXPLAINABILITY = "EXPLAINABILITY"


@dataclass(frozen=True, slots=True)
class CaseEnvelope:
    case_id: str
    revision: int
    fact_set_hash: str
    knowledge_release_id: str
    terminology_release_id: str

    def __post_init__(self) -> None:
        if not self.case_id.strip():
            raise ValueError("case_id is required")
        if self.revision < 1:
            raise ValueError("revision must be positive")
        if not all(value.strip() for value in (
            self.fact_set_hash, self.knowledge_release_id, self.terminology_release_id
        )):
            raise ValueError("facts, terminology and governed knowledge must be versioned")


@dataclass(frozen=True, slots=True)
class KernelRequest:
    request_id: str
    kind: RequestKind
    case: CaseEnvelope
    required_capabilities: frozenset[Capability]
    policy_version: str

    def __post_init__(self) -> None:
        if not self.request_id.strip() or not self.policy_version.strip():
            raise ValueError("request_id and policy_version are required")
        if not self.required_capabilities:
            raise ValueError("at least one capability is required")

    def canonical_record(self) -> dict[str, object]:
        return {
            "schema_version": "kernel-request/v1",
            "request_id": self.request_id,
            "kind": self.kind.value,
            "case": {
                "case_id": self.case.case_id,
                "revision": self.case.revision,
                "fact_set_hash": self.case.fact_set_hash,
                "knowledge_release_id": self.case.knowledge_release_id,
                "terminology_release_id": self.case.terminology_release_id,
            },
            "required_capabilities": sorted(item.value for item in self.required_capabilities),
            "policy_version": self.policy_version,
        }


@dataclass(frozen=True, slots=True)
class PlannedEngine:
    engine_id: str
    reason_code: str
    dependency_ids: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class ExecutionPlan:
    request_id: str
    policy_version: str
    engine_sequence: tuple[PlannedEngine, ...]
    plan_fingerprint: str
    metadata: Mapping[str, str] = field(default_factory=dict)

    def __post_init__(self) -> None:
        object.__setattr__(self, "metadata", MappingProxyType(dict(self.metadata)))
        if not self.engine_sequence:
            raise ValueError("an execution plan cannot be empty")
