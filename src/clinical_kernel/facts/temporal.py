"""Read-only temporal projections over explicit fact status."""

from dataclasses import dataclass

from .contracts import ClinicalFact, ClinicalFactSet, FactTemporalStatus


@dataclass(frozen=True, slots=True)
class FactTemporalState:
    fact_set_hash: str
    current: tuple[ClinicalFact, ...]
    historical: tuple[ClinicalFact, ...]
    resolved: tuple[ClinicalFact, ...]
    proposed: tuple[ClinicalFact, ...]
    stopped: tuple[ClinicalFact, ...]
    unknown: tuple[ClinicalFact, ...]

    @classmethod
    def from_fact_set(cls, fact_set: ClinicalFactSet) -> "FactTemporalState":
        grouped = {
            status: tuple(fact for fact in fact_set.facts if fact.temporal_status is status)
            for status in FactTemporalStatus
        }
        return cls(
            fact_set_hash=fact_set.fact_set_hash,
            current=grouped[FactTemporalStatus.CURRENT],
            historical=grouped[FactTemporalStatus.HISTORICAL],
            resolved=grouped[FactTemporalStatus.RESOLVED],
            proposed=grouped[FactTemporalStatus.PROPOSED],
            stopped=grouped[FactTemporalStatus.STOPPED],
            unknown=grouped[FactTemporalStatus.UNKNOWN],
        )
