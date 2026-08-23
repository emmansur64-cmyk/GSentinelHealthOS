"""Shared immutable contracts; contains no clinical rules or engine-to-engine calls."""

from dataclasses import dataclass
from enum import StrEnum
from hashlib import sha256

from clinical_kernel.contracts import Capability, CaseEnvelope
from clinical_kernel.evidence import EvidenceAssessment
from clinical_kernel.facts import ClinicalFactSet, FactTemporalState
from clinical_kernel.knowledge import ClinicalKnowledgeRule, KnowledgeVerificationStatus


class EngineStatus(StrEnum):
    SUCCEEDED = "SUCCEEDED"
    ABSTAINED = "ABSTAINED"
    INSUFFICIENT_INPUT = "INSUFFICIENT_INPUT"
    FAILED = "FAILED"


class EngineErrorCode(StrEnum):
    NO_APPLICABLE_KNOWLEDGE = "NO_APPLICABLE_KNOWLEDGE"
    NO_ADJUDICATED_EVIDENCE = "NO_ADJUDICATED_EVIDENCE"
    REQUIRED_UPSTREAM_MISSING = "REQUIRED_UPSTREAM_MISSING"
    UPSTREAM_NOT_SUCCESSFUL = "UPSTREAM_NOT_SUCCESSFUL"
    CONTRACT_VIOLATION = "CONTRACT_VIOLATION"
    INTERNAL_FAILURE = "INTERNAL_FAILURE"


@dataclass(frozen=True, slots=True)
class EngineError:
    code: EngineErrorCode
    message: str
    retryable: bool = False

    def __post_init__(self) -> None:
        if not self.message.strip():
            raise ValueError("engine error message is required")


@dataclass(frozen=True, slots=True)
class ConclusionProvenance:
    engine_id: str
    engine_version: str
    fact_ids: tuple[str, ...] = ()
    rule_ids: tuple[str, ...] = ()
    evidence_need_ids: tuple[str, ...] = ()
    evidence_document_ids: tuple[str, ...] = ()
    upstream_conclusion_ids: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if not self.engine_id.strip() or not self.engine_version.strip():
            raise ValueError("conclusion provenance requires engine identity")
        if not any((self.fact_ids, self.rule_ids, self.evidence_need_ids,
                    self.evidence_document_ids, self.upstream_conclusion_ids)):
            raise ValueError("a clinical conclusion requires traceable provenance")


@dataclass(frozen=True, slots=True)
class EngineConclusion:
    conclusion_id: str
    conclusion_type: str
    statement_code: str
    provenance: ConclusionProvenance
    rank: int | None = None

    def __post_init__(self) -> None:
        if not self.conclusion_id.strip() or not self.conclusion_type.strip() or not self.statement_code.strip():
            raise ValueError("clinical conclusion identity and typed statement are required")
        if self.rank is not None and self.rank < 1:
            raise ValueError("conclusion rank must be positive")


@dataclass(frozen=True, slots=True)
class EngineResult:
    engine_id: str
    engine_version: str
    status: EngineStatus
    conclusions: tuple[EngineConclusion, ...] = ()
    errors: tuple[EngineError, ...] = ()

    def __post_init__(self) -> None:
        if not self.engine_id.strip() or not self.engine_version.strip():
            raise ValueError("engine result identity is required")
        if self.status is EngineStatus.SUCCEEDED and not self.conclusions:
            raise ValueError("a successful engine must publish conclusions")
        if self.status is not EngineStatus.SUCCEEDED and self.conclusions:
            raise ValueError("non-successful engines cannot publish conclusions")
        if self.status is not EngineStatus.SUCCEEDED and not self.errors:
            raise ValueError("non-successful engines require typed errors")
        ids = [item.conclusion_id for item in self.conclusions]
        if len(ids) != len(set(ids)):
            raise ValueError("engine conclusion IDs must be unique")
        if any(item.provenance.engine_id != self.engine_id for item in self.conclusions):
            raise ValueError("conclusion provenance must be owned by the producing engine")


@dataclass(frozen=True, slots=True)
class EngineInput:
    request_id: str
    case: CaseEnvelope
    fact_set: ClinicalFactSet
    temporal_state: FactTemporalState
    knowledge_release_id: str
    knowledge_rules: tuple[ClinicalKnowledgeRule, ...] = ()
    evidence_assessments: tuple[EvidenceAssessment, ...] = ()
    upstream_results: tuple[EngineResult, ...] = ()

    def __post_init__(self) -> None:
        if not self.request_id.strip() or not self.knowledge_release_id.strip():
            raise ValueError("engine input requires request and knowledge identities")
        if self.case.fact_set_hash != self.fact_set.fact_set_hash:
            raise ValueError("engine case and fact set do not match")
        if self.fact_set.fact_set_hash != self.temporal_state.fact_set_hash:
            raise ValueError("engine facts and temporal state do not match")
        if self.case.knowledge_release_id != self.knowledge_release_id:
            raise ValueError("engine knowledge release does not match case")
        if any(rule.verification_status is not KnowledgeVerificationStatus.GOVERNANCE_ACCEPTED
               for rule in self.knowledge_rules):
            raise ValueError("engines may consume only governance-accepted knowledge")
        rule_ids = {rule.rule_id for rule in self.knowledge_rules}
        if any(item.rule_id not in rule_ids for item in self.evidence_assessments):
            raise ValueError("evidence assessment is not linked to supplied knowledge")
        engine_ids = [item.engine_id for item in self.upstream_results]
        if len(engine_ids) != len(set(engine_ids)):
            raise ValueError("upstream engine results must be unique")


def validate_engine_input(
    value: EngineInput,
    *,
    capability: Capability,
    allowed_upstream: frozenset[str],
) -> None:
    if any(rule.owner_capability is not capability for rule in value.knowledge_rules):
        raise ValueError("engine received knowledge owned by another capability")
    actual = {item.engine_id for item in value.upstream_results}
    if not actual.issubset(allowed_upstream):
        raise ValueError("engine received an undeclared upstream result")


def abstained(engine_id: str, version: str, code: EngineErrorCode, message: str,
              *, insufficient: bool = False) -> EngineResult:
    return EngineResult(
        engine_id, version,
        EngineStatus.INSUFFICIENT_INPUT if insufficient else EngineStatus.ABSTAINED,
        errors=(EngineError(code, message),),
    )


def rule_conclusions(value: EngineInput, *, engine_id: str, version: str,
                     conclusion_type: str) -> EngineResult:
    fact_ids_by_concept = {
        concept_id: tuple(f.fact_id for f in value.fact_set.facts if f.concept_id == concept_id)
        for concept_id in {f.concept_id for f in value.fact_set.facts}
    }
    conclusions = []
    for rule in sorted(value.knowledge_rules, key=lambda item: item.rule_id):
        fact_ids = tuple(sorted({fact_id for concept in rule.concept_ids
                                 for fact_id in fact_ids_by_concept.get(concept, ())}))
        if not fact_ids:
            continue
        seed = "|".join((engine_id, version, rule.rule_id, *fact_ids))
        conclusions.append(EngineConclusion(
            f"{engine_id.lower()}:{sha256(seed.encode()).hexdigest()[:20]}",
            conclusion_type, f"{conclusion_type}:{rule.effect.value}",
            ConclusionProvenance(engine_id, version, fact_ids=fact_ids, rule_ids=(rule.rule_id,)),
        ))
    if not conclusions:
        return abstained(engine_id, version, EngineErrorCode.NO_APPLICABLE_KNOWLEDGE,
                         "no governed rule applies to the supplied facts")
    return EngineResult(engine_id, version, EngineStatus.SUCCEEDED, tuple(conclusions))


def upstream_conclusions(value: EngineInput, *, engine_id: str, version: str,
                         conclusion_type: str, statement_code: str) -> EngineResult:
    source = tuple(c for result in value.upstream_results if result.status is EngineStatus.SUCCEEDED
                   for c in result.conclusions)
    if not source:
        return abstained(engine_id, version, EngineErrorCode.UPSTREAM_NOT_SUCCESSFUL,
                         "no successful upstream conclusions are available", insufficient=True)
    conclusions = tuple(EngineConclusion(
        f"{engine_id.lower()}:{index:04d}", conclusion_type, statement_code,
        ConclusionProvenance(engine_id, version, upstream_conclusion_ids=(item.conclusion_id,)),
        rank=index,
    ) for index, item in enumerate(source, start=1))
    return EngineResult(engine_id, version, EngineStatus.SUCCEEDED, conclusions)


def evidence_conclusions(value: EngineInput, *, engine_id: str, version: str,
                         conclusion_type: str) -> EngineResult:
    if not value.evidence_assessments:
        return abstained(engine_id, version, EngineErrorCode.NO_ADJUDICATED_EVIDENCE,
                         "no governed evidence assessment is available", insufficient=True)
    conclusions = tuple(EngineConclusion(
        f"{engine_id.lower()}:{sha256((item.need_id + '|' + item.rule_id).encode()).hexdigest()[:20]}",
        conclusion_type, f"{conclusion_type}:{item.verdict.value}",
        ConclusionProvenance(
            engine_id, version, rule_ids=(item.rule_id,), evidence_need_ids=(item.need_id,),
            evidence_document_ids=tuple(sorted(item.document_ids)),
        ),
    ) for item in sorted(value.evidence_assessments, key=lambda item: (item.rule_id, item.need_id)))
    return EngineResult(engine_id, version, EngineStatus.SUCCEEDED, conclusions)
