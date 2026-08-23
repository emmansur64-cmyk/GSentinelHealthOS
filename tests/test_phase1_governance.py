from dataclasses import replace
from datetime import datetime, timezone

import pytest

from clinical_kernel import ClinicalKernel, RequestKind
from clinical_kernel.errors import ClinicalKernelError, KernelErrorCode
from clinical_kernel.facts import (
    ClinicalFact,
    ClinicalFactDelta,
    ClinicalFactSet,
    FactKind,
    FactPolarity,
    FactProvenance,
    FactTemporalStatus,
    FactValueType,
    GovernedTerminologyRegistry,
    ProvenanceKind,
    StructuredCaseInput,
    TerminologyConcept,
    UnitPolicy,
    apply_delta,
)
from clinical_kernel.state import CaseScope, InMemoryClinicalStateStore, SQLiteClinicalStateStore
from clinical_kernel.knowledge import ClinicalKnowledgeRelease, InMemoryKnowledgeStore


NOW = datetime(2026, 8, 23, tzinfo=timezone.utc)


def fact(fact_id: str, concept_id: str = "obs") -> ClinicalFact:
    return ClinicalFact(
        fact_id=fact_id,
        subject_id="subject-1",
        kind=FactKind.OBSERVATION,
        concept_id=concept_id,
        value=True,
        unit=None,
        polarity=FactPolarity.PRESENT,
        temporal_status=FactTemporalStatus.CURRENT,
        observed_at=NOW,
        provenance=FactProvenance(
            ProvenanceKind.CLINICIAN_ENTERED, "source-1", NOW, "clinician-1"
        ),
    )


def terminology() -> GovernedTerminologyRegistry:
    return GovernedTerminologyRegistry(
        (TerminologyConcept(
            "obs", "test", "1", "Observation", frozenset({FactKind.OBSERVATION}),
            FactValueType.BOOLEAN, UnitPolicy.FORBIDDEN,
        ),),
        release_id="terminology-v1",
    )


class AcceptTestSignatures:
    def verify(self, *, manifest_hash: str, signature: str) -> bool:
        return signature == f"test-signature:{manifest_hash}"


def knowledge() -> InMemoryKnowledgeStore:
    manifest_hash = ClinicalKnowledgeRelease.calculate_manifest_hash("knowledge-empty-v1", NOW, (), ())
    release = ClinicalKnowledgeRelease(
        "knowledge-empty-v1", NOW, (), (), manifest_hash, f"test-signature:{manifest_hash}"
    )
    store = InMemoryKnowledgeStore(AcceptTestSignatures())
    store.register(release)
    store.activate(release.release_id)
    return store


def incoming(revision: int, facts: tuple[ClinicalFact, ...]) -> StructuredCaseInput:
    return StructuredCaseInput("case-1", "subject-1", revision, facts)


SCOPE = CaseScope("tenant-1", "clinician-1", "conversation-1", "case-1")


def test_unknown_concepts_fail_closed_with_typed_error() -> None:
    with pytest.raises(ClinicalKernelError) as caught:
        ClinicalKernel(terminology=terminology(), knowledge_store=knowledge()).prepare(
            request_id="request-1",
            kind=RequestKind.PATIENT_CASE,
            incoming=incoming(1, (fact("f1", "unknown"),)),
            scope=SCOPE,
        )
    assert caught.value.detail.code is KernelErrorCode.UNKNOWN_CONCEPT


def test_delta_requires_explicit_add_replace_or_retract() -> None:
    base = ClinicalFactSet.build(subject_id="subject-1", facts=(fact("f1"),))
    changed = replace(fact("f1"), value=False)
    result = apply_delta(
        base,
        ClinicalFactDelta(base_revision=1, target_revision=2, replacements=(changed,), additions=(fact("f2"),)),
    )
    assert {item.fact_id for item in result.facts} == {"f1", "f2"}
    assert next(item for item in result.facts if item.fact_id == "f1").value is False


def test_revision_must_advance_one_and_existing_revision_is_immutable() -> None:
    kernel = ClinicalKernel(terminology=terminology(), knowledge_store=knowledge())
    kernel.prepare(request_id="r1", kind=RequestKind.PATIENT_CASE, incoming=incoming(1, (fact("f1"),)), scope=SCOPE)
    with pytest.raises(ClinicalKernelError) as gap:
        kernel.prepare(request_id="r3", kind=RequestKind.CASE_REASSESSMENT, incoming=incoming(3, (fact("f1"),)), scope=SCOPE)
    assert gap.value.detail.code is KernelErrorCode.REVISION_GAP
    with pytest.raises(ClinicalKernelError) as conflict:
        kernel.prepare(
            request_id="r1-conflict",
            kind=RequestKind.PATIENT_CASE,
            incoming=incoming(1, (replace(fact("f1"), value=False),)),
            scope=SCOPE,
        )
    assert conflict.value.detail.code is KernelErrorCode.REVISION_CONFLICT


def test_request_id_replay_is_allowed_only_for_identical_input() -> None:
    store = InMemoryClinicalStateStore()
    kernel = ClinicalKernel(terminology=terminology(), knowledge_store=knowledge(), state_store=store)
    first = kernel.prepare(request_id="same", kind=RequestKind.PATIENT_CASE, incoming=incoming(1, (fact("f1"),)), scope=SCOPE)
    replay = kernel.prepare(request_id="same", kind=RequestKind.PATIENT_CASE, incoming=incoming(1, (fact("f1"),)), scope=SCOPE)
    assert replay.plan.plan_fingerprint == first.plan.plan_fingerprint
    with pytest.raises(ClinicalKernelError) as conflict:
        kernel.prepare(
            request_id="same",
            kind=RequestKind.CASE_REASSESSMENT,
            incoming=incoming(2, (fact("f1"), fact("f2"))),
            scope=SCOPE,
        )
    assert conflict.value.detail.code is KernelErrorCode.IDEMPOTENCY_CONFLICT


def test_case_state_is_isolated_by_full_scope() -> None:
    store = InMemoryClinicalStateStore()
    kernel = ClinicalKernel(terminology=terminology(), knowledge_store=knowledge(), state_store=store)
    kernel.prepare(request_id="a", kind=RequestKind.PATIENT_CASE, incoming=incoming(1, (fact("f1"),)), scope=SCOPE)
    other = CaseScope("tenant-2", "clinician-1", "conversation-1", "case-1")
    kernel.prepare(request_id="b", kind=RequestKind.PATIENT_CASE, incoming=incoming(1, (fact("f2"),)), scope=other)
    assert store.latest(SCOPE).fact_set.fact_set_hash != store.latest(other).fact_set.fact_set_hash


def test_sqlite_store_survives_restart_and_replays_idempotently(tmp_path) -> None:
    database = tmp_path / "kernel-state.sqlite3"
    first_kernel = ClinicalKernel(
        terminology=terminology(), knowledge_store=knowledge(), state_store=SQLiteClinicalStateStore(database)
    )
    first = first_kernel.prepare(
        request_id="durable-request",
        kind=RequestKind.PATIENT_CASE,
        incoming=incoming(1, (fact("f1"),)),
        scope=SCOPE,
    )
    restarted_store = SQLiteClinicalStateStore(database)
    restarted_kernel = ClinicalKernel(
        terminology=terminology(), knowledge_store=knowledge(), state_store=restarted_store
    )
    replay = restarted_kernel.prepare(
        request_id="durable-request",
        kind=RequestKind.PATIENT_CASE,
        incoming=incoming(1, (fact("f1"),)),
        scope=SCOPE,
    )
    assert replay.plan.plan_fingerprint == first.plan.plan_fingerprint
    assert restarted_store.latest(SCOPE).revision == 1


def test_replaying_old_request_never_rolls_back_latest_revision() -> None:
    store = InMemoryClinicalStateStore()
    kernel = ClinicalKernel(terminology=terminology(), knowledge_store=knowledge(), state_store=store)
    kernel.prepare(request_id="r1", kind=RequestKind.PATIENT_CASE, incoming=incoming(1, (fact("f1"),)), scope=SCOPE)
    kernel.prepare(
        request_id="r2",
        kind=RequestKind.CASE_REASSESSMENT,
        incoming=incoming(2, (fact("f1"), fact("f2"))),
        scope=SCOPE,
    )
    kernel.prepare(request_id="r1", kind=RequestKind.PATIENT_CASE, incoming=incoming(1, (fact("f1"),)), scope=SCOPE)
    assert store.latest(SCOPE).revision == 2
