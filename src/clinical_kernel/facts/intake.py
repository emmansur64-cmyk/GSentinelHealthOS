"""The only Phase-1 entry point that can construct an authoritative fact set."""

from dataclasses import dataclass, replace

from clinical_kernel.contracts import CaseEnvelope

from .contracts import ClinicalFact, ClinicalFactSet
from .temporal import FactTemporalState
from .terminology import GovernedTerminologyRegistry
from .units import GovernedUnitRegistry


@dataclass(frozen=True, slots=True)
class StructuredCaseInput:
    case_id: str
    subject_id: str
    revision: int
    facts: tuple[ClinicalFact, ...]


@dataclass(frozen=True, slots=True)
class AcceptedClinicalIntake:
    case: CaseEnvelope
    fact_set: ClinicalFactSet
    temporal_state: FactTemporalState
    terminology_release_id: str
    authority: str = "CLINICAL_KERNEL"


class ClinicalIntakeService:
    """Validates typed inputs and mints the authoritative case envelope."""

    def __init__(
        self,
        terminology: GovernedTerminologyRegistry,
        units: GovernedUnitRegistry | None = None,
    ) -> None:
        self._terminology = terminology
        self._units = units

    def accept(
        self,
        incoming: StructuredCaseInput,
        *,
        knowledge_release_id: str,
    ) -> AcceptedClinicalIntake:
        if not incoming.case_id.strip() or not knowledge_release_id.strip():
            raise ValueError("case and governed knowledge identities are required")
        if incoming.revision < 1:
            raise ValueError("revision must be positive")
        normalized_facts: list[ClinicalFact] = []
        for fact in incoming.facts:
            if fact.unit is not None:
                if self._units is None:
                    raise ValueError("unit-bearing facts require a governed unit registry")
                value, unit, rule_id = self._units.normalize(fact.value, fact.unit)
                fact = replace(fact, value=value, unit=unit, unit_rule_id=rule_id)
            self._terminology.validate(fact)
            normalized_facts.append(fact)
        fact_set = ClinicalFactSet.build(subject_id=incoming.subject_id, facts=tuple(normalized_facts))
        case = CaseEnvelope(
            case_id=incoming.case_id,
            revision=incoming.revision,
            fact_set_hash=fact_set.fact_set_hash,
            knowledge_release_id=knowledge_release_id,
            terminology_release_id=self._terminology.release_id,
        )
        return AcceptedClinicalIntake(
            case=case,
            fact_set=fact_set,
            temporal_state=FactTemporalState.from_fact_set(fact_set),
            terminology_release_id=self._terminology.release_id,
        )
