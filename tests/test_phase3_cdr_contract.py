import json
from datetime import UTC, datetime
from pathlib import Path

import pytest

from clinical_kernel.contracts import Capability, CaseEnvelope
from clinical_kernel.facts import (
    ClinicalFact,
    ClinicalFactSet,
    FactKind,
    FactPolarity,
    FactProvenance,
    FactTemporalState,
    FactTemporalStatus,
    ProvenanceKind,
)
from clinical_kernel.MOTORES.CDR import CDREngine, CDRInput
from clinical_kernel.MOTORES.common import (
    ConclusionProvenance,
    EngineConclusion,
    EngineResult,
    EngineStatus,
)

NOW = datetime(2026, 8, 23, tzinfo=UTC)
FIXTURE_PATH = Path(__file__).parent / "fixtures" / "structural_contract" / "cdr_v1.json"


def _input() -> CDRInput:
    fact = ClinicalFact(
        "fact-1", "subject-1", FactKind.OBSERVATION, "synthetic-concept", True, None,
        FactPolarity.PRESENT, FactTemporalStatus.CURRENT, NOW,
        FactProvenance(ProvenanceKind.CLINICIAN_ENTERED, "source-1", NOW, "actor-1"),
    )
    fact_set = ClinicalFactSet.build(subject_id="subject-1", facts=(fact,))
    case = CaseEnvelope("case-1", 1, fact_set.fact_set_hash, "knowledge-structural-v1", "terminology-v1")
    upstream = EngineResult(
        "structural-upstream", "structural-upstream/v1", Capability.REASONING, EngineStatus.SUCCEEDED,
        conclusions=(EngineConclusion(
            "upstream-conclusion-1", "STRUCTURAL_CANDIDATE", "SYNTHETIC_ONLY",
            ConclusionProvenance(
                "structural-upstream", "structural-upstream/v1", "knowledge-structural-v1",
                ("fact-1",), rule_ids=("rule-1",), evidence_need_ids=("need-1",),
                evidence_document_ids=("document-1",),
            ),
        ),),
    )
    return CDRInput(
        "request-1", case, fact_set, FactTemporalState.from_fact_set(fact_set),
        "knowledge-structural-v1", upstream_results=(upstream,),
    )


def test_cdr_structural_fixture_is_not_labelled_as_clinically_validated() -> None:
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    assert fixture["fixture_class"] == "STRUCTURAL_CONTRACT_ONLY"
    assert fixture["clinical_validation"] == "NOT_PERFORMED"
    assert fixture["external_clinical_review"] == "NOT_PERFORMED"


def test_cdr_preserves_fact_knowledge_and_adjudicated_evidence_links() -> None:
    result = CDREngine().run(_input())
    assert result.status is EngineStatus.SUCCEEDED
    conclusion = result.conclusions[0]
    assert conclusion.provenance.fact_ids == ("fact-1",)
    assert conclusion.provenance.knowledge_release_id == "knowledge-structural-v1"
    assert conclusion.provenance.rule_ids == ("rule-1",)
    assert conclusion.provenance.evidence_need_ids == ("need-1",)
    assert conclusion.provenance.evidence_document_ids == ("document-1",)
    assert conclusion.provenance.upstream_conclusion_ids == ("upstream-conclusion-1",)


def test_conclusion_contract_rejects_broken_fact_provenance_link() -> None:
    with pytest.raises(ValueError, match="source fact IDs"):
        ConclusionProvenance(
            "structural-upstream", "structural-upstream/v1", "knowledge-structural-v1", (),
            rule_ids=("rule-1",),
        )


def test_cdr_input_rejects_unknown_upstream_fact_link() -> None:
    valid = _input()
    broken_provenance = ConclusionProvenance(
        "structural-upstream", "structural-upstream/v1", "knowledge-structural-v1",
        ("fact-does-not-exist",),
    )
    broken_result = EngineResult(
        "structural-upstream", "structural-upstream/v1", Capability.REASONING,
        EngineStatus.SUCCEEDED,
        conclusions=(EngineConclusion(
            "upstream-conclusion-1", "STRUCTURAL_CANDIDATE", "SYNTHETIC_ONLY", broken_provenance,
        ),),
    )
    with pytest.raises(ValueError, match="unknown source fact"):
        CDRInput(
            valid.request_id, valid.case, valid.fact_set, valid.temporal_state,
            valid.knowledge_release_id, upstream_results=(broken_result,),
        )
