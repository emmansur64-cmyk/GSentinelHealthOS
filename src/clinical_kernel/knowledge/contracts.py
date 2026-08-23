"""Immutable knowledge artifacts separated from patient facts."""

import json
from dataclasses import dataclass
from datetime import date, datetime
from enum import StrEnum
from hashlib import sha256

from clinical_kernel.contracts import Capability


class KnowledgeVerificationStatus(StrEnum):
    DRAFT = "DRAFT"
    PENDING_CLINICAL_REVIEW = "PENDING_CLINICAL_REVIEW"
    GOVERNANCE_ACCEPTED = "GOVERNANCE_ACCEPTED"
    RETIRED = "RETIRED"


class KnowledgeEffect(StrEnum):
    SUPPORT = "SUPPORT"
    CONTRADICT = "CONTRADICT"
    CONSTRAIN = "CONSTRAIN"
    REQUIRE_INFORMATION = "REQUIRE_INFORMATION"


class KnowledgeConflictStatus(StrEnum):
    UNRESOLVED = "UNRESOLVED"
    RESOLVED = "RESOLVED"


@dataclass(frozen=True, slots=True)
class KnowledgeConflict:
    conflict_id: str
    rule_ids: tuple[str, ...]
    status: KnowledgeConflictStatus
    resolution_rule_id: str | None = None

    def __post_init__(self) -> None:
        if not self.conflict_id.strip() or len(self.rule_ids) < 2:
            raise ValueError("knowledge conflict requires identity and at least two rules")
        if len(set(self.rule_ids)) != len(self.rule_ids):
            raise ValueError("knowledge conflict rule IDs must be unique")
        if self.status is KnowledgeConflictStatus.RESOLVED and self.resolution_rule_id not in self.rule_ids:
            raise ValueError("resolved conflict must identify its governing rule")

    def canonical_record(self) -> dict[str, object]:
        return {
            "conflict_id": self.conflict_id,
            "rule_ids": list(self.rule_ids),
            "status": self.status.value,
            "resolution_rule_id": self.resolution_rule_id,
        }


@dataclass(frozen=True, slots=True)
class KnowledgeSource:
    source_id: str
    title: str
    canonical_url: str
    publisher: str
    publication_date: date
    accessed_at: datetime
    content_hash: str
    identifier: str | None = None

    def __post_init__(self) -> None:
        if not all(value.strip() for value in (
            self.source_id, self.title, self.canonical_url, self.publisher, self.content_hash
        )):
            raise ValueError("knowledge source identity and provenance are required")
        if not self.canonical_url.startswith("https://"):
            raise ValueError("knowledge source must use a canonical HTTPS URL")
        if self.accessed_at.tzinfo is None or self.accessed_at.utcoffset() is None:
            raise ValueError("accessed_at must include a timezone")

    def canonical_record(self) -> dict[str, object]:
        return {
            "source_id": self.source_id,
            "title": self.title,
            "canonical_url": self.canonical_url,
            "publisher": self.publisher,
            "publication_date": self.publication_date.isoformat(),
            "accessed_at": self.accessed_at.isoformat(),
            "content_hash": self.content_hash,
            "identifier": self.identifier,
        }


@dataclass(frozen=True, slots=True)
class ClinicalKnowledgeRule:
    rule_id: str
    version: str
    owner_capability: Capability
    effect: KnowledgeEffect
    concept_ids: tuple[str, ...]
    source_ids: tuple[str, ...]
    valid_from: date
    valid_until: date | None
    verification_status: KnowledgeVerificationStatus
    reviewer_id: str | None = None

    def __post_init__(self) -> None:
        if not self.rule_id.strip() or not self.version.strip():
            raise ValueError("knowledge rule identity is required")
        if not self.concept_ids or not self.source_ids:
            raise ValueError("a knowledge rule requires concepts and sources")
        if len(set(self.concept_ids)) != len(self.concept_ids) or len(set(self.source_ids)) != len(self.source_ids):
            raise ValueError("knowledge rule references must be unique")
        if self.valid_until is not None and self.valid_until < self.valid_from:
            raise ValueError("knowledge validity interval is inverted")
        if self.verification_status is KnowledgeVerificationStatus.GOVERNANCE_ACCEPTED and not self.reviewer_id:
            raise ValueError("accepted knowledge requires a clinical governance reviewer")

    def canonical_record(self) -> dict[str, object]:
        return {
            "rule_id": self.rule_id,
            "version": self.version,
            "owner_capability": self.owner_capability.value,
            "effect": self.effect.value,
            "concept_ids": list(self.concept_ids),
            "source_ids": list(self.source_ids),
            "valid_from": self.valid_from.isoformat(),
            "valid_until": None if self.valid_until is None else self.valid_until.isoformat(),
            "verification_status": self.verification_status.value,
            "reviewer_id": self.reviewer_id,
        }


@dataclass(frozen=True, slots=True)
class ClinicalKnowledgeRelease:
    release_id: str
    created_at: datetime
    rules: tuple[ClinicalKnowledgeRule, ...]
    sources: tuple[KnowledgeSource, ...]
    manifest_hash: str
    signature: str
    conflicts: tuple[KnowledgeConflict, ...] = ()
    schema_version: str = "clinical-knowledge-release/v1"

    @staticmethod
    def calculate_manifest_hash(
        release_id: str,
        created_at: datetime,
        rules: tuple[ClinicalKnowledgeRule, ...],
        sources: tuple[KnowledgeSource, ...],
        conflicts: tuple[KnowledgeConflict, ...] = (),
    ) -> str:
        payload = {
            "schema_version": "clinical-knowledge-release/v1",
            "release_id": release_id,
            "created_at": created_at.isoformat(),
            "rules": [rule.canonical_record() for rule in sorted(rules, key=lambda item: item.rule_id)],
            "sources": [source.canonical_record() for source in sorted(sources, key=lambda item: item.source_id)],
            "conflicts": [
                conflict.canonical_record() for conflict in sorted(conflicts, key=lambda item: item.conflict_id)
            ],
        }
        canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        return sha256(canonical.encode("utf-8")).hexdigest()

    def validate_structure(self) -> None:
        if self.schema_version != "clinical-knowledge-release/v1":
            raise ValueError("unsupported knowledge release schema version")
        if not self.release_id.strip() or not self.signature.strip():
            raise ValueError("knowledge release identity and external signature are required")
        if self.created_at.tzinfo is None or self.created_at.utcoffset() is None:
            raise ValueError("created_at must include a timezone")
        rule_ids = [rule.rule_id for rule in self.rules]
        source_ids = [source.source_id for source in self.sources]
        if len(rule_ids) != len(set(rule_ids)) or len(source_ids) != len(set(source_ids)):
            raise ValueError("release identities must be unique")
        known_sources = set(source_ids)
        if any(set(rule.source_ids) - known_sources for rule in self.rules):
            raise ValueError("knowledge rule references an absent source")
        known_rules = set(rule_ids)
        if any(set(conflict.rule_ids) - known_rules for conflict in self.conflicts):
            raise ValueError("knowledge conflict references an absent rule")
        conflict_ids = [conflict.conflict_id for conflict in self.conflicts]
        if len(conflict_ids) != len(set(conflict_ids)):
            raise ValueError("knowledge conflict identities must be unique")
        expected = self.calculate_manifest_hash(
            self.release_id, self.created_at, self.rules, self.sources, self.conflicts
        )
        if expected != self.manifest_hash:
            raise ValueError("knowledge release manifest hash mismatch")

    def lookup(self, *, concept_ids: frozenset[str], capability: Capability, on_date: date) -> tuple[ClinicalKnowledgeRule, ...]:
        return tuple(
            rule
            for rule in sorted(self.rules, key=lambda item: item.rule_id)
            if rule.owner_capability is capability
            and bool(concept_ids.intersection(rule.concept_ids))
            and rule.valid_from <= on_date
            and (rule.valid_until is None or on_date <= rule.valid_until)
            and rule.verification_status is KnowledgeVerificationStatus.GOVERNANCE_ACCEPTED
        )
