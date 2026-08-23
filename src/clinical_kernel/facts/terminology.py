"""Versioned allow-list of clinical concepts; it contains no inferred medicine."""

from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from types import MappingProxyType

from clinical_kernel.errors import ClinicalKernelError, KernelErrorCode, KernelErrorDetail

from .contracts import ClinicalFact, FactKind


class FactValueType(StrEnum):
    BOOLEAN = "BOOLEAN"
    INTEGER = "INTEGER"
    NUMBER = "NUMBER"
    TEXT = "TEXT"


class UnitPolicy(StrEnum):
    FORBIDDEN = "FORBIDDEN"
    REQUIRED = "REQUIRED"


@dataclass(frozen=True, slots=True)
class TerminologyConcept:
    concept_id: str
    code_system: str
    code: str
    display: str
    allowed_kinds: frozenset[FactKind]
    value_type: FactValueType
    unit_policy: UnitPolicy
    canonical_unit: str | None = None

    def __post_init__(self) -> None:
        if not all(value.strip() for value in (self.concept_id, self.code_system, self.code, self.display)):
            raise ValueError("terminology concept identity is incomplete")
        if not self.allowed_kinds:
            raise ValueError("a terminology concept must allow at least one fact kind")
        if self.unit_policy is UnitPolicy.REQUIRED and not self.canonical_unit:
            raise ValueError("a unit-bearing concept requires a canonical unit")
        if self.unit_policy is UnitPolicy.FORBIDDEN and self.canonical_unit is not None:
            raise ValueError("a unitless concept cannot declare a canonical unit")


class GovernedTerminologyRegistry:
    def __init__(self, concepts: tuple[TerminologyConcept, ...], *, release_id: str) -> None:
        if not release_id.strip():
            raise ValueError("terminology release_id is required")
        by_id = {concept.concept_id: concept for concept in concepts}
        if len(by_id) != len(concepts):
            raise ValueError("concept_id must be unique within a terminology release")
        self.release_id = release_id
        self._concepts: Mapping[str, TerminologyConcept] = MappingProxyType(by_id)

    def validate(self, fact: ClinicalFact) -> None:
        concept = self._concepts.get(fact.concept_id)
        if concept is None:
            raise ClinicalKernelError(
                KernelErrorDetail(
                    KernelErrorCode.UNKNOWN_CONCEPT,
                    f"concept is not governed by terminology release {self.release_id}",
                    field="concept_id",
                )
            )
        if fact.kind not in concept.allowed_kinds:
            raise ClinicalKernelError(
                KernelErrorDetail(
                    KernelErrorCode.CONCEPT_KIND_MISMATCH,
                    "fact kind is not permitted for the governed concept",
                    field="kind",
                )
            )
        actual_type = (
            FactValueType.BOOLEAN if type(fact.value) is bool else
            FactValueType.INTEGER if type(fact.value) is int else
            FactValueType.NUMBER if type(fact.value) is float else
            FactValueType.TEXT
        )
        compatible = actual_type is concept.value_type or (
            concept.value_type is FactValueType.NUMBER and actual_type is FactValueType.INTEGER
        )
        if not compatible:
            raise ClinicalKernelError(
                KernelErrorDetail(KernelErrorCode.INVALID_INPUT, "fact value type is not permitted for concept", field="value")
            )
        if concept.unit_policy is UnitPolicy.FORBIDDEN and fact.unit is not None:
            raise ClinicalKernelError(
                KernelErrorDetail(KernelErrorCode.INVALID_INPUT, "concept does not permit a unit", field="unit")
            )
        if concept.unit_policy is UnitPolicy.REQUIRED:
            if fact.unit != concept.canonical_unit or not fact.unit_rule_id:
                raise ClinicalKernelError(
                    KernelErrorDetail(KernelErrorCode.INVALID_INPUT, "fact must use a governed canonical unit", field="unit")
                )
