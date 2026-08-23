"""Immutable and deterministic Phase-1 clinical fact contracts."""

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from math import isfinite
from typing import TypeAlias

from clinical_kernel.canonical import canonical_sha256


FactValue: TypeAlias = str | int | float | bool


class FactKind(StrEnum):
    DEMOGRAPHIC = "DEMOGRAPHIC"
    SYMPTOM = "SYMPTOM"
    SIGN = "SIGN"
    OBSERVATION = "OBSERVATION"
    LABORATORY = "LABORATORY"
    DIAGNOSIS = "DIAGNOSIS"
    MEDICATION = "MEDICATION"
    ALLERGY = "ALLERGY"
    PROCEDURE = "PROCEDURE"


class FactPolarity(StrEnum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    UNKNOWN = "UNKNOWN"


class FactTemporalStatus(StrEnum):
    CURRENT = "CURRENT"
    HISTORICAL = "HISTORICAL"
    RESOLVED = "RESOLVED"
    PROPOSED = "PROPOSED"
    STOPPED = "STOPPED"
    UNKNOWN = "UNKNOWN"


class ProvenanceKind(StrEnum):
    CLINICIAN_ENTERED = "CLINICIAN_ENTERED"
    PATIENT_REPORTED = "PATIENT_REPORTED"
    DEVICE_OBSERVED = "DEVICE_OBSERVED"
    LAB_RESULT = "LAB_RESULT"
    IMPORTED_RECORD = "IMPORTED_RECORD"


def _require_aware(value: datetime, field_name: str) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field_name} must include a timezone")


@dataclass(frozen=True, slots=True)
class FactProvenance:
    kind: ProvenanceKind
    source_id: str
    recorded_at: datetime
    actor_id: str

    def __post_init__(self) -> None:
        if not self.source_id.strip() or not self.actor_id.strip():
            raise ValueError("fact provenance requires source_id and actor_id")
        _require_aware(self.recorded_at, "recorded_at")


@dataclass(frozen=True, slots=True)
class ClinicalFact:
    fact_id: str
    subject_id: str
    kind: FactKind
    concept_id: str
    value: FactValue
    unit: str | None
    polarity: FactPolarity
    temporal_status: FactTemporalStatus
    observed_at: datetime
    provenance: FactProvenance
    unit_rule_id: str | None = None
    schema_version: str = "clinical-fact/v1"

    def __post_init__(self) -> None:
        for field_name in ("fact_id", "subject_id", "concept_id", "schema_version"):
            if not str(getattr(self, field_name)).strip():
                raise ValueError(f"{field_name} is required")
        if self.schema_version != "clinical-fact/v1":
            raise ValueError("unsupported clinical fact schema version")
        _require_aware(self.observed_at, "observed_at")
        if isinstance(self.value, float) and not isfinite(self.value):
            raise ValueError("non-finite numbers are not valid clinical fact values")
        if isinstance(self.value, str) and not self.value.strip():
            raise ValueError("text clinical fact values cannot be blank")
        if self.unit is not None and not self.unit.strip():
            raise ValueError("unit cannot be blank")
        if self.unit_rule_id is not None and not self.unit_rule_id.strip():
            raise ValueError("unit_rule_id cannot be blank")
        if self.unit is None and self.unit_rule_id is not None:
            raise ValueError("unit_rule_id requires a unit")

    def canonical_record(self) -> dict[str, object]:
        return {
            "schema_version": self.schema_version,
            "fact_id": self.fact_id,
            "subject_id": self.subject_id,
            "kind": self.kind.value,
            "concept_id": self.concept_id,
            "value": self.value,
            "unit": self.unit,
            "unit_rule_id": self.unit_rule_id,
            "polarity": self.polarity.value,
            "temporal_status": self.temporal_status.value,
            "observed_at": self.observed_at.isoformat(),
            "provenance": {
                "kind": self.provenance.kind.value,
                "source_id": self.provenance.source_id,
                "recorded_at": self.provenance.recorded_at.isoformat(),
                "actor_id": self.provenance.actor_id,
            },
        }


@dataclass(frozen=True, slots=True)
class ClinicalFactSet:
    subject_id: str
    facts: tuple[ClinicalFact, ...]
    fact_set_hash: str
    schema_version: str = "clinical-fact-set/v1"

    @classmethod
    def build(cls, *, subject_id: str, facts: tuple[ClinicalFact, ...]) -> "ClinicalFactSet":
        if not subject_id.strip():
            raise ValueError("subject_id is required")
        if not facts:
            raise ValueError("a patient case requires at least one typed fact")
        if any(fact.subject_id != subject_id for fact in facts):
            raise ValueError("all facts must belong to the same subject")
        fact_ids = [fact.fact_id for fact in facts]
        if len(fact_ids) != len(set(fact_ids)):
            raise ValueError("fact_id must be unique inside a fact set")
        ordered = tuple(sorted(facts, key=lambda item: item.fact_id))
        payload = {
            "schema_version": "clinical-fact-set/v1",
            "subject_id": subject_id,
            "facts": [fact.canonical_record() for fact in ordered],
        }
        return cls(
            subject_id=subject_id,
            facts=ordered,
            fact_set_hash=canonical_sha256(payload),
        )
