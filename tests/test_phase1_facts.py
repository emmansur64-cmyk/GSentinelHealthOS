from datetime import datetime, timezone
from decimal import Decimal

import pytest

from clinical_kernel.facts import (
    ClinicalFact,
    ClinicalFactSet,
    ClinicalIntakeService,
    FactKind,
    FactPolarity,
    FactProvenance,
    FactTemporalStatus,
    FactValueType,
    GovernedTerminologyRegistry,
    GovernedUnitRegistry,
    ProvenanceKind,
    StructuredCaseInput,
    TerminologyConcept,
    UnitPolicy,
    UnitRule,
)
from clinical_kernel.knowledge import ClinicalKnowledgeRelease, InMemoryKnowledgeStore


NOW = datetime(2026, 8, 23, 12, 0, tzinfo=timezone.utc)


def _terminology() -> GovernedTerminologyRegistry:
    return GovernedTerminologyRegistry(
        (
            TerminologyConcept(
                concept_id="coded-observation",
                code_system="test-system",
                code="OBS-1",
                display="Governed test observation",
                allowed_kinds=frozenset({FactKind.OBSERVATION}),
                value_type=FactValueType.BOOLEAN,
                unit_policy=UnitPolicy.FORBIDDEN,
            ),
        ),
        release_id="terminology-test-v1",
    )


class _AcceptTestSignatures:
    def verify(self, *, manifest_hash: str, signature: str) -> bool:
        return signature == f"test-signature:{manifest_hash}"


def _knowledge() -> InMemoryKnowledgeStore:
    created_at = NOW
    manifest_hash = ClinicalKnowledgeRelease.calculate_manifest_hash(
        "knowledge-empty-v1", created_at, (), ()
    )
    release = ClinicalKnowledgeRelease(
        "knowledge-empty-v1", created_at, (), (), manifest_hash,
        f"test-signature:{manifest_hash}",
    )
    store = InMemoryKnowledgeStore(_AcceptTestSignatures())
    store.register(release)
    store.activate(release.release_id)
    return store


def _fact(
    fact_id: str,
    status: FactTemporalStatus = FactTemporalStatus.CURRENT,
    subject_id: str = "patient-1",
) -> ClinicalFact:
    return ClinicalFact(
        fact_id=fact_id,
        subject_id=subject_id,
        kind=FactKind.OBSERVATION,
        concept_id="coded-observation",
        value=True,
        unit=None,
        polarity=FactPolarity.PRESENT,
        temporal_status=status,
        observed_at=NOW,
        provenance=FactProvenance(
            kind=ProvenanceKind.CLINICIAN_ENTERED,
            source_id="encounter-1",
            recorded_at=NOW,
            actor_id="clinician-1",
        ),
    )


def test_fact_set_hash_is_order_independent_and_deterministic() -> None:
    first = ClinicalFactSet.build(subject_id="patient-1", facts=(_fact("b"), _fact("a")))
    second = ClinicalFactSet.build(subject_id="patient-1", facts=(_fact("a"), _fact("b")))
    assert first.fact_set_hash == second.fact_set_hash
    assert [fact.fact_id for fact in first.facts] == ["a", "b"]


def test_intake_is_the_kernel_authority_and_preserves_explicit_temporality() -> None:
    accepted = ClinicalIntakeService(_terminology()).accept(
        StructuredCaseInput(
            case_id="case-1",
            subject_id="patient-1",
            revision=1,
            facts=(_fact("current"), _fact("resolved", FactTemporalStatus.RESOLVED)),
        ),
        knowledge_release_id="knowledge-empty-v1",
    )
    assert accepted.authority == "CLINICAL_KERNEL"
    assert [fact.fact_id for fact in accepted.temporal_state.current] == ["current"]
    assert [fact.fact_id for fact in accepted.temporal_state.resolved] == ["resolved"]
    assert accepted.case.fact_set_hash == accepted.fact_set.fact_set_hash


def test_mixed_subjects_and_duplicate_fact_ids_are_rejected() -> None:
    duplicate = (_fact("same"), _fact("same"))
    with pytest.raises(ValueError, match="unique"):
        ClinicalFactSet.build(subject_id="patient-1", facts=duplicate)
    foreign = _fact("foreign", subject_id="patient-2")
    with pytest.raises(ValueError, match="same subject"):
        ClinicalFactSet.build(subject_id="patient-1", facts=(foreign,))


def test_naive_timestamps_are_rejected() -> None:
    with pytest.raises(ValueError, match="timezone"):
        FactProvenance(
            kind=ProvenanceKind.IMPORTED_RECORD,
            source_id="record-1",
            recorded_at=datetime(2026, 8, 23),
            actor_id="importer-1",
        )


def test_only_versioned_unit_rules_can_normalize_values() -> None:
    registry = GovernedUnitRegistry(
        (UnitRule("source-u", "canonical-u", Decimal("0.1"), rule_id="unit-rule-1"),),
        release_id="units-v1",
    )
    assert registry.normalize(25, "source-u") == (2.5, "canonical-u", "unit-rule-1")
    with pytest.raises(ValueError, match="not governed"):
        registry.normalize(25, "unknown-u")


def test_public_kernel_owns_intake_policy_and_orchestration() -> None:
    from clinical_kernel import ClinicalKernel, RequestKind
    from clinical_kernel.state import CaseScope

    prepared = ClinicalKernel(terminology=_terminology(), knowledge_store=_knowledge()).prepare(
        request_id="request-1",
        kind=RequestKind.PATIENT_CASE,
        scope=CaseScope("tenant-1", "clinician-1", "conversation-1", "case-1"),
        incoming=StructuredCaseInput(
            case_id="case-1",
            subject_id="patient-1",
            revision=1,
            facts=(_fact("fact-1"),),
        ),
    )
    assert prepared.intake.authority == "CLINICAL_KERNEL"
    assert prepared.plan.metadata["authority"] == "CLINICAL_KERNEL"
    assert prepared.plan.policy_version == "kernel-policy/phase1-v1"
    assert len(prepared.plan.engine_sequence) == 11
