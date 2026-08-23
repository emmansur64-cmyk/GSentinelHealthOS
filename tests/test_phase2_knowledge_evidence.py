from dataclasses import replace
from datetime import UTC, date, datetime

import pytest

from clinical_kernel.contracts import Capability
from clinical_kernel.errors import ClinicalKernelError
from clinical_kernel.evidence import (
    EvidenceDocument,
    EvidenceGateway,
    EvidenceNeed,
    EvidenceNeedLevel,
    EvidencePlanner,
    EvidenceRetrievalPolicy,
    EvidenceRetrievalStatus,
)
from clinical_kernel.knowledge import (
    ClinicalKnowledgeRelease,
    ClinicalKnowledgeRule,
    InMemoryKnowledgeStore,
    KnowledgeConflict,
    KnowledgeConflictStatus,
    KnowledgeEffect,
    KnowledgeSource,
    KnowledgeVerificationStatus,
)

NOW = datetime(2026, 8, 23, tzinfo=UTC)


class SignatureVerifier:
    def verify(self, *, manifest_hash: str, signature: str) -> bool:
        return signature == f"signed:{manifest_hash}"


def source() -> KnowledgeSource:
    return KnowledgeSource(
        source_id="source-1",
        title="Governed source for structural tests",
        canonical_url="https://example.org/governed-source",
        publisher="Test publisher",
        publication_date=date(2026, 1, 1),
        accessed_at=NOW,
        content_hash="source-content-sha256",
        identifier="test:source-1",
    )


def rule(
    rule_id: str = "rule-1",
    status: KnowledgeVerificationStatus = KnowledgeVerificationStatus.GOVERNANCE_ACCEPTED,
    effect: KnowledgeEffect = KnowledgeEffect.SUPPORT,
) -> ClinicalKnowledgeRule:
    return ClinicalKnowledgeRule(
        rule_id=rule_id,
        version="1.0.0",
        owner_capability=Capability.REASONING,
        effect=effect,
        concept_ids=("concept-1",),
        source_ids=("source-1",),
        valid_from=date(2026, 1, 1),
        valid_until=None,
        verification_status=status,
        reviewer_id="reviewer-1" if status is KnowledgeVerificationStatus.GOVERNANCE_ACCEPTED else None,
    )


def release(
    release_id: str,
    rules: tuple[ClinicalKnowledgeRule, ...],
    conflicts: tuple[KnowledgeConflict, ...] = (),
    valid_signature: bool = True,
) -> ClinicalKnowledgeRelease:
    sources = (source(),) if rules else ()
    manifest = ClinicalKnowledgeRelease.calculate_manifest_hash(release_id, NOW, rules, sources, conflicts)
    signature = f"signed:{manifest}" if valid_signature else "invalid"
    return ClinicalKnowledgeRelease(release_id, NOW, rules, sources, manifest, signature, conflicts)


def test_only_integrity_verified_governance_accepted_release_can_activate() -> None:
    store = InMemoryKnowledgeStore(SignatureVerifier())
    pending = release("pending", (rule(status=KnowledgeVerificationStatus.PENDING_CLINICAL_REVIEW),))
    store.register(pending)
    with pytest.raises(ClinicalKernelError, match="unaccepted"):
        store.activate("pending")
    unsigned = release("unsigned", (), valid_signature=False)
    store.register(unsigned)
    with pytest.raises(ClinicalKernelError, match="signature"):
        store.activate("unsigned")


def test_manifest_tampering_is_rejected_at_registration() -> None:
    valid = release("release-1", (rule(),))
    tampered = replace(valid, rules=(replace(rule(), version="2.0.0"),))
    with pytest.raises(ClinicalKernelError, match="manifest hash"):
        InMemoryKnowledgeStore(SignatureVerifier()).register(tampered)


def test_unresolved_conflicts_block_activation() -> None:
    rules = (rule("rule-a"), rule("rule-b", effect=KnowledgeEffect.CONTRADICT))
    conflict = KnowledgeConflict(
        "conflict-1", ("rule-a", "rule-b"), KnowledgeConflictStatus.UNRESOLVED
    )
    store = InMemoryKnowledgeStore(SignatureVerifier())
    store.register(release("conflicted", rules, (conflict,)))
    with pytest.raises(ClinicalKernelError, match="unresolved"):
        store.activate("conflicted")


def test_lookup_is_deterministic_versioned_and_date_bounded() -> None:
    governed = release("release-1", (rule("rule-b"), rule("rule-a")))
    governed.validate_structure()
    matches = governed.lookup(
        concept_ids=frozenset({"concept-1"}),
        capability=Capability.REASONING,
        on_date=date(2026, 8, 23),
    )
    assert [item.rule_id for item in matches] == ["rule-a", "rule-b"]


def test_evidence_planner_is_deterministic_phi_minimal_and_blocking_for_unreviewed_rules() -> None:
    pending = rule(status=KnowledgeVerificationStatus.PENDING_CLINICAL_REVIEW)
    planner = EvidencePlanner()
    first = planner.plan_for_rules(
        capability=Capability.REASONING,
        concept_ids=frozenset({"concept-1"}),
        candidate_rules=(pending,),
    )
    second = planner.plan_for_rules(
        capability=Capability.REASONING,
        concept_ids=frozenset({"concept-1"}),
        candidate_rules=(pending,),
    )
    assert first == second
    assert first[0].level is EvidenceNeedLevel.BLOCKING
    assert not hasattr(first[0], "case_id")
    assert not hasattr(first[0], "subject_id")


def test_activation_and_rollback_preserve_immutable_releases() -> None:
    store = InMemoryKnowledgeStore(SignatureVerifier())
    first = release("release-1", ())
    second = release("release-2", ())
    store.register(first)
    store.register(second)
    store.activate("release-1")
    store.activate("release-2")
    assert store.rollback().release_id == "release-1"


class Provider:
    provider_id = "governed-provider"

    def __init__(self, url: str = "https://evidence.example.org/document") -> None:
        self.url = url
        self.calls = 0

    def retrieve(self, need: EvidenceNeed) -> tuple[EvidenceDocument, ...]:
        self.calls += 1
        return (
            EvidenceDocument(
                "doc-1", "Evidence document", self.url, "Publisher",
                date(2026, 1, 1), NOW, "document-sha256", ("doi:test",),
            ),
        )


def evidence_need() -> EvidenceNeed:
    return EvidenceNeed(
        "need-1", Capability.REASONING, ("concept-1",), ("rule-1",),
        EvidenceNeedLevel.REQUIRED, "REVALIDATE_RULE",
    )


def test_gateway_allows_one_code_governed_provider_round() -> None:
    provider = Provider()
    gateway = EvidenceGateway(
        (provider,),
        EvidenceRetrievalPolicy(
            "evidence-policy-v1", {provider.provider_id: frozenset({"evidence.example.org"})}
        ),
    )
    bundle = gateway.retrieve_once(evidence_need(), provider_id=provider.provider_id)
    assert bundle.status is EvidenceRetrievalStatus.RETRIEVED
    assert bundle.complete is True
    assert provider.calls == 1


def test_gateway_rejects_unapproved_sources_without_partial_evidence() -> None:
    provider = Provider("https://untrusted.example.net/document")
    gateway = EvidenceGateway(
        (provider,),
        EvidenceRetrievalPolicy(
            "evidence-policy-v1", {provider.provider_id: frozenset({"evidence.example.org"})}
        ),
    )
    bundle = gateway.retrieve_once(evidence_need(), provider_id=provider.provider_id)
    assert bundle.status is EvidenceRetrievalStatus.REJECTED_BY_POLICY
    assert bundle.documents == ()


def test_gateway_provider_failure_never_fabricates_evidence() -> None:
    class FailingProvider:
        provider_id = "failing"

        def retrieve(self, need: EvidenceNeed) -> tuple[EvidenceDocument, ...]:
            raise RuntimeError("offline")

    gateway = EvidenceGateway(
        (FailingProvider(),),
        EvidenceRetrievalPolicy("evidence-policy-v1", {"failing": frozenset({"example.org"})}),
    )
    bundle = gateway.retrieve_once(evidence_need(), provider_id="failing")
    assert bundle.status is EvidenceRetrievalStatus.UNAVAILABLE
    assert bundle.documents == ()
