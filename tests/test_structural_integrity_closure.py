import base64
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import datetime, timezone
from decimal import Decimal
import sqlite3

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from clinical_kernel.canonical import canonical_sha256
from clinical_kernel.errors import ClinicalKernelError, KernelErrorCode
from clinical_kernel.facts import (
    ClinicalFact, ClinicalFactSet, ClinicalIntakeService, FactKind, FactPolarity,
    FactProvenance, FactTemporalStatus, FactValueType, GovernedTerminologyRegistry,
    GovernedUnitRegistry, ProvenanceKind, StructuredCaseInput, TerminologyConcept,
    UnitPolicy, UnitRule,
)
from clinical_kernel.knowledge import (
    ClinicalKnowledgeRelease, Ed25519KnowledgeVerifier, SIGNATURE_DOMAIN,
    SQLiteKnowledgeStore,
)
from clinical_kernel.state import (
    CaseScope, IdempotencyRecord, InMemoryClinicalStateStore,
    SQLiteClinicalStateStore, StoredCaseRevision,
)


NOW = datetime(2026, 8, 23, tzinfo=timezone.utc)
SCOPE = CaseScope("tenant", "clinician", "conversation", "case")


def fact(value: bool = True) -> ClinicalFact:
    return ClinicalFact(
        "fact", "subject", FactKind.OBSERVATION, "observation", value, None,
        FactPolarity.PRESENT, FactTemporalStatus.CURRENT, NOW,
        FactProvenance(ProvenanceKind.CLINICIAN_ENTERED, "source", NOW, "actor"),
    )


def stored(*, value: bool = True, knowledge: str = "knowledge-a") -> StoredCaseRevision:
    return StoredCaseRevision(
        SCOPE, 1, ClinicalFactSet.build(subject_id="subject", facts=(fact(value),)),
        knowledge, "terminology-a",
    )


@pytest.mark.parametrize("store_factory", [
    lambda tmp_path: InMemoryClinicalStateStore(),
    lambda tmp_path: SQLiteClinicalStateStore(tmp_path / "state.sqlite3"),
])
def test_state_stores_reject_same_revision_with_changed_governance(tmp_path, store_factory) -> None:
    store = store_factory(tmp_path)
    store.commit(stored(), IdempotencyRecord("r1", "i1", "p1"))
    with pytest.raises(ClinicalKernelError) as caught:
        store.commit(stored(knowledge="knowledge-b"), IdempotencyRecord("r2", "i2", "p2"))
    assert caught.value.detail.code is KernelErrorCode.REVISION_CONFLICT
    assert store.latest(SCOPE).knowledge_release_id == "knowledge-a"
    assert store.idempotency("r2") is None


def test_sqlite_serializes_competing_writers_and_commits_exactly_one(tmp_path) -> None:
    database = tmp_path / "concurrent.sqlite3"
    first = SQLiteClinicalStateStore(database)
    second = SQLiteClinicalStateStore(database)

    def attempt(store, candidate, request_id):
        try:
            store.commit(candidate, IdempotencyRecord(request_id, request_id, request_id))
            return "committed"
        except ClinicalKernelError as exc:
            return exc.detail.code

    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(
            lambda args: attempt(*args),
            ((first, stored(value=True), "r1"), (second, stored(value=False), "r2")),
        ))
    assert outcomes.count("committed") == 1
    assert outcomes.count(KernelErrorCode.REVISION_CONFLICT) == 1


def test_canonical_fingerprints_are_structured_and_delimiter_safe() -> None:
    assert canonical_sha256({"a": "x:y", "b": "z"}) != canonical_sha256({"a": "x", "b": "y:z"})
    assert canonical_sha256({"b": "z", "a": "x:y"}) == canonical_sha256({"a": "x:y", "b": "z"})


def test_intake_enforces_value_type_and_governed_unit_normalization() -> None:
    terminology = GovernedTerminologyRegistry((TerminologyConcept(
        "laboratory", "test", "LAB", "Laboratory", frozenset({FactKind.LABORATORY}),
        FactValueType.NUMBER, UnitPolicy.REQUIRED, "canonical-u",
    ),), release_id="terminology-v2")
    units = GovernedUnitRegistry((
        UnitRule("source-u", "canonical-u", Decimal("0.5"), rule_id="unit-rule-v1"),
    ), release_id="units-v1")
    numeric = replace(fact(), kind=FactKind.LABORATORY, concept_id="laboratory", value=10, unit="source-u")
    accepted = ClinicalIntakeService(terminology, units).accept(
        StructuredCaseInput("case", "subject", 1, (numeric,)), knowledge_release_id="knowledge-v1"
    )
    normalized = accepted.fact_set.facts[0]
    assert (normalized.value, normalized.unit, normalized.unit_rule_id) == (5.0, "canonical-u", "unit-rule-v1")
    invalid = replace(numeric, value="ten")
    with pytest.raises(ValueError, match="numeric"):
        ClinicalIntakeService(terminology, units).accept(
            StructuredCaseInput("case", "subject", 1, (invalid,)), knowledge_release_id="knowledge-v1"
        )


def signed_release(private_key: Ed25519PrivateKey, release_id: str) -> ClinicalKnowledgeRelease:
    manifest = ClinicalKnowledgeRelease.calculate_manifest_hash(release_id, NOW, (), ())
    signature = base64.b64encode(private_key.sign(SIGNATURE_DOMAIN + manifest.encode("ascii"))).decode("ascii")
    return ClinicalKnowledgeRelease(release_id, NOW, (), (), manifest, signature)


def verifier(tmp_path, private_key: Ed25519PrivateKey) -> Ed25519KnowledgeVerifier:
    public_path = tmp_path / "external-public-key.pem"
    public_path.write_bytes(private_key.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo,
    ))
    return Ed25519KnowledgeVerifier(public_path)


def test_ed25519_and_durable_knowledge_survive_restart_with_receipts(tmp_path) -> None:
    private_key = Ed25519PrivateKey.generate()
    database = tmp_path / "knowledge.sqlite3"
    first = SQLiteKnowledgeStore(database, verifier(tmp_path, private_key))
    release_a = signed_release(private_key, "release-a")
    release_b = signed_release(private_key, "release-b")
    first.register(release_a)
    first.register(release_b)
    first.activate("release-a")
    first.activate("release-b")

    restarted = SQLiteKnowledgeStore(database, verifier(tmp_path, private_key))
    assert restarted.active().release_id == "release-b"
    assert restarted.rollback().release_id == "release-a"
    with sqlite3.connect(database) as connection:
        assert connection.execute("SELECT action FROM activation_receipts ORDER BY sequence").fetchall() == [
            ("ACTIVATE",), ("ACTIVATE",), ("ROLLBACK",),
        ]


def test_durable_knowledge_fails_closed_after_database_tampering(tmp_path) -> None:
    private_key = Ed25519PrivateKey.generate()
    database = tmp_path / "knowledge.sqlite3"
    store = SQLiteKnowledgeStore(database, verifier(tmp_path, private_key))
    release = signed_release(private_key, "release-a")
    store.register(release)
    store.activate(release.release_id)
    with sqlite3.connect(database) as connection:
        connection.execute("UPDATE knowledge_releases SET release_json = replace(release_json, 'release-a', 'release-x')")
    with pytest.raises(ClinicalKernelError) as caught:
        store.active()
    assert caught.value.detail.code is KernelErrorCode.PERSISTENCE_FAILURE


def test_ed25519_rejects_signature_from_another_key(tmp_path) -> None:
    trusted = Ed25519PrivateKey.generate()
    attacker = Ed25519PrivateKey.generate()
    store = SQLiteKnowledgeStore(tmp_path / "knowledge.sqlite3", verifier(tmp_path, trusted))
    release = signed_release(attacker, "attacker-release")
    store.register(release)
    with pytest.raises(ClinicalKernelError, match="signature"):
        store.activate(release.release_id)
