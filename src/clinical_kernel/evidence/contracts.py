"""PHI-minimal evidence contracts. Evidence is never a patient fact."""

from dataclasses import dataclass
from datetime import date, datetime
from enum import StrEnum

from clinical_kernel.contracts import Capability


class EvidenceNeedLevel(StrEnum):
    OPTIONAL = "OPTIONAL"
    REQUIRED = "REQUIRED"
    BLOCKING = "BLOCKING"


class EvidenceVerdict(StrEnum):
    SUPPORTS = "SUPPORTS"
    CONTRADICTS = "CONTRADICTS"
    INCONCLUSIVE = "INCONCLUSIVE"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class EvidenceRetrievalStatus(StrEnum):
    RETRIEVED = "RETRIEVED"
    UNAVAILABLE = "UNAVAILABLE"
    REJECTED_BY_POLICY = "REJECTED_BY_POLICY"


@dataclass(frozen=True, slots=True)
class EvidenceNeed:
    need_id: str
    capability: Capability
    concept_ids: tuple[str, ...]
    rule_ids: tuple[str, ...]
    level: EvidenceNeedLevel
    reason_code: str

    def __post_init__(self) -> None:
        if not self.need_id.strip() or not self.reason_code.strip() or not self.concept_ids:
            raise ValueError("evidence need identity, concepts and reason are required")


@dataclass(frozen=True, slots=True)
class EvidenceDocument:
    document_id: str
    title: str
    canonical_url: str
    publisher: str
    publication_date: date
    retrieved_at: datetime
    content_hash: str
    identifiers: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if not all(value.strip() for value in (
            self.document_id, self.title, self.canonical_url, self.publisher, self.content_hash
        )):
            raise ValueError("evidence document provenance is incomplete")
        if not self.canonical_url.startswith("https://"):
            raise ValueError("evidence document URL must use HTTPS")
        if self.retrieved_at.tzinfo is None or self.retrieved_at.utcoffset() is None:
            raise ValueError("retrieved_at must include a timezone")


@dataclass(frozen=True, slots=True)
class EvidenceBundle:
    need_id: str
    documents: tuple[EvidenceDocument, ...]
    provider_id: str
    query_fingerprint: str
    complete: bool
    status: EvidenceRetrievalStatus = EvidenceRetrievalStatus.RETRIEVED
    failure_code: str | None = None


@dataclass(frozen=True, slots=True)
class EvidenceAssessment:
    need_id: str
    rule_id: str
    document_ids: tuple[str, ...]
    verdict: EvidenceVerdict
    rationale_code: str
    adjudicator_id: str

    def __post_init__(self) -> None:
        if not all(value.strip() for value in (
            self.need_id, self.rule_id, self.rationale_code, self.adjudicator_id
        )):
            raise ValueError("evidence assessment traceability is incomplete")
