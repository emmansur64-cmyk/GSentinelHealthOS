"""Governed patient-fact boundary owned by the ClinicalKernel."""

from .contracts import (
    ClinicalFact,
    ClinicalFactSet,
    FactKind,
    FactPolarity,
    FactProvenance,
    FactTemporalStatus,
    ProvenanceKind,
)
from .intake import ClinicalIntakeService, StructuredCaseInput
from .revisions import ClinicalFactDelta, apply_delta
from .terminology import FactValueType, GovernedTerminologyRegistry, TerminologyConcept, UnitPolicy
from .temporal import FactTemporalState
from .units import GovernedUnitRegistry, UnitRule

__all__ = [
    "ClinicalFact",
    "ClinicalFactSet",
    "ClinicalIntakeService",
    "ClinicalFactDelta",
    "FactKind",
    "FactPolarity",
    "FactProvenance",
    "FactTemporalState",
    "FactTemporalStatus",
    "GovernedUnitRegistry",
    "GovernedTerminologyRegistry",
    "FactValueType",
    "ProvenanceKind",
    "StructuredCaseInput",
    "TerminologyConcept",
    "UnitPolicy",
    "UnitRule",
    "apply_delta",
]
