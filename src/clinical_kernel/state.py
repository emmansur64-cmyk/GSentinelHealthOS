"""Scoped Phase-1 state and idempotency contracts."""

import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from threading import RLock
from typing import Protocol

from .errors import ClinicalKernelError, KernelErrorCode, KernelErrorDetail
from .facts.contracts import (
    ClinicalFact,
    ClinicalFactSet,
    FactKind,
    FactPolarity,
    FactProvenance,
    FactTemporalStatus,
    ProvenanceKind,
)


@dataclass(frozen=True, slots=True)
class CaseScope:
    tenant_id: str
    clinician_id: str
    conversation_id: str
    case_id: str

    def __post_init__(self) -> None:
        if not all(value.strip() for value in (
            self.tenant_id, self.clinician_id, self.conversation_id, self.case_id
        )):
            raise ValueError("case scope must be fully specified")


@dataclass(frozen=True, slots=True)
class StoredCaseRevision:
    scope: CaseScope
    revision: int
    fact_set: ClinicalFactSet
    knowledge_release_id: str
    terminology_release_id: str

    def __post_init__(self) -> None:
        if self.revision < 1 or not self.knowledge_release_id.strip() or not self.terminology_release_id.strip():
            raise ValueError("stored revision requires positive revision and governed release identities")


def _same_governed_state(left: StoredCaseRevision, right: StoredCaseRevision) -> bool:
    return (
        left.scope == right.scope
        and left.revision == right.revision
        and left.fact_set == right.fact_set
        and left.knowledge_release_id == right.knowledge_release_id
        and left.terminology_release_id == right.terminology_release_id
    )


def _validate_commit_transition(
    current: StoredCaseRevision | None,
    incoming: StoredCaseRevision,
) -> None:
    if current is None:
        if incoming.revision != 1:
            raise ClinicalKernelError(
                KernelErrorDetail(KernelErrorCode.REVISION_GAP, "the first stored revision must be 1")
            )
        return
    if incoming.revision < current.revision or incoming.revision > current.revision + 1:
        raise ClinicalKernelError(
            KernelErrorDetail(KernelErrorCode.REVISION_GAP, "stored revision must replay current or advance by one")
        )
    if incoming.revision == current.revision and not _same_governed_state(current, incoming):
        raise ClinicalKernelError(
            KernelErrorDetail(KernelErrorCode.REVISION_CONFLICT, "governed revision content is immutable")
        )
    if incoming.revision == current.revision + 1 and (
        current.fact_set == incoming.fact_set
        and current.knowledge_release_id == incoming.knowledge_release_id
        and current.terminology_release_id == incoming.terminology_release_id
    ):
        raise ClinicalKernelError(
            KernelErrorDetail(KernelErrorCode.REVISION_CONFLICT, "a new revision must change governed state")
        )


@dataclass(frozen=True, slots=True)
class IdempotencyRecord:
    request_id: str
    input_fingerprint: str
    plan_fingerprint: str


class ClinicalStateStore(Protocol):
    def latest(self, scope: CaseScope) -> StoredCaseRevision | None: ...
    def idempotency(self, request_id: str) -> IdempotencyRecord | None: ...
    def commit(self, revision: StoredCaseRevision, idempotency: IdempotencyRecord) -> None: ...


class InMemoryClinicalStateStore:
    """Thread-safe reference adapter; production requires a durable adapter."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._revisions: dict[CaseScope, StoredCaseRevision] = {}
        self._requests: dict[str, IdempotencyRecord] = {}

    def latest(self, scope: CaseScope) -> StoredCaseRevision | None:
        with self._lock:
            return self._revisions.get(scope)

    def idempotency(self, request_id: str) -> IdempotencyRecord | None:
        with self._lock:
            return self._requests.get(request_id)

    def commit(self, revision: StoredCaseRevision, idempotency: IdempotencyRecord) -> None:
        with self._lock:
            existing = self._requests.get(idempotency.request_id)
            if existing is not None and existing != idempotency:
                raise ClinicalKernelError(
                    KernelErrorDetail(KernelErrorCode.IDEMPOTENCY_CONFLICT, "request changed during commit")
                )
            current = self._revisions.get(revision.scope)
            if existing == idempotency:
                if current is None or current.revision < revision.revision:
                    raise ClinicalKernelError(
                        KernelErrorDetail(KernelErrorCode.PERSISTENCE_FAILURE, "idempotency record has no committed revision")
                    )
                return
            _validate_commit_transition(current, revision)
            if current is None or revision.revision > current.revision:
                self._revisions[revision.scope] = revision
            self._requests[idempotency.request_id] = idempotency


def _encode_fact_set(fact_set: ClinicalFactSet) -> str:
    return json.dumps(
        {
            "subject_id": fact_set.subject_id,
            "fact_set_hash": fact_set.fact_set_hash,
            "facts": [fact.canonical_record() for fact in fact_set.facts],
        },
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )


def _decode_fact_set(payload: str) -> ClinicalFactSet:
    raw = json.loads(payload)
    facts = tuple(
        ClinicalFact(
            fact_id=item["fact_id"],
            subject_id=item["subject_id"],
            kind=FactKind(item["kind"]),
            concept_id=item["concept_id"],
            value=item["value"],
            unit=item["unit"],
            polarity=FactPolarity(item["polarity"]),
            temporal_status=FactTemporalStatus(item["temporal_status"]),
            observed_at=datetime.fromisoformat(item["observed_at"]),
            provenance=FactProvenance(
                kind=ProvenanceKind(item["provenance"]["kind"]),
                source_id=item["provenance"]["source_id"],
                recorded_at=datetime.fromisoformat(item["provenance"]["recorded_at"]),
                actor_id=item["provenance"]["actor_id"],
            ),
            unit_rule_id=item.get("unit_rule_id"),
            schema_version=item["schema_version"],
        )
        for item in raw["facts"]
    )
    rebuilt = ClinicalFactSet.build(subject_id=raw["subject_id"], facts=facts)
    if rebuilt.fact_set_hash != raw["fact_set_hash"]:
        raise ClinicalKernelError(
            KernelErrorDetail(KernelErrorCode.PERSISTENCE_FAILURE, "stored fact set failed integrity validation")
        )
    return rebuilt


class SQLiteClinicalStateStore:
    """Durable, transactionally committed Phase-1 reference adapter."""

    def __init__(self, database_path: str | Path) -> None:
        self._path = str(Path(database_path).resolve())
        self._lock = RLock()
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._path, timeout=30.0)
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 30000")
        connection.execute("PRAGMA journal_mode = WAL")
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS case_revisions (
                    tenant_id TEXT NOT NULL, clinician_id TEXT NOT NULL,
                    conversation_id TEXT NOT NULL, case_id TEXT NOT NULL,
                    revision INTEGER NOT NULL, knowledge_release_id TEXT NOT NULL,
                    terminology_release_id TEXT NOT NULL,
                    fact_set_json TEXT NOT NULL,
                    PRIMARY KEY (tenant_id, clinician_id, conversation_id, case_id, revision)
                );
                CREATE TABLE IF NOT EXISTS idempotency_records (
                    request_id TEXT PRIMARY KEY, input_fingerprint TEXT NOT NULL,
                    plan_fingerprint TEXT NOT NULL
                );
                """
            )

    def latest(self, scope: CaseScope) -> StoredCaseRevision | None:
        with self._connect() as connection:
            row = connection.execute(
                """SELECT revision, knowledge_release_id, terminology_release_id, fact_set_json FROM case_revisions
                   WHERE tenant_id=? AND clinician_id=? AND conversation_id=? AND case_id=?
                   ORDER BY revision DESC LIMIT 1""",
                (scope.tenant_id, scope.clinician_id, scope.conversation_id, scope.case_id),
            ).fetchone()
        return None if row is None else StoredCaseRevision(
            scope, row[0], _decode_fact_set(row[3]), row[1], row[2]
        )

    def idempotency(self, request_id: str) -> IdempotencyRecord | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT input_fingerprint, plan_fingerprint FROM idempotency_records WHERE request_id=?",
                (request_id,),
            ).fetchone()
        return None if row is None else IdempotencyRecord(request_id, row[0], row[1])

    def commit(self, revision: StoredCaseRevision, idempotency: IdempotencyRecord) -> None:
        with self._lock, self._connect() as connection:
            try:
                connection.execute("BEGIN IMMEDIATE")
                existing_request = connection.execute(
                    "SELECT input_fingerprint, plan_fingerprint FROM idempotency_records WHERE request_id=?",
                    (idempotency.request_id,),
                ).fetchone()
                if existing_request is not None and existing_request != (
                    idempotency.input_fingerprint, idempotency.plan_fingerprint
                ):
                    raise ClinicalKernelError(
                        KernelErrorDetail(KernelErrorCode.IDEMPOTENCY_CONFLICT, "request changed during commit")
                    )
                if existing_request is not None:
                    return
                latest_row = connection.execute(
                    """SELECT revision, knowledge_release_id, terminology_release_id, fact_set_json
                       FROM case_revisions WHERE tenant_id=? AND clinician_id=?
                       AND conversation_id=? AND case_id=? ORDER BY revision DESC LIMIT 1""",
                    (
                        revision.scope.tenant_id, revision.scope.clinician_id,
                        revision.scope.conversation_id, revision.scope.case_id,
                    ),
                ).fetchone()
                current = None if latest_row is None else StoredCaseRevision(
                    revision.scope,
                    latest_row[0],
                    _decode_fact_set(latest_row[3]),
                    latest_row[1],
                    latest_row[2],
                )
                _validate_commit_transition(current, revision)
                existing_revision = connection.execute(
                    """SELECT knowledge_release_id, terminology_release_id, fact_set_json
                       FROM case_revisions WHERE tenant_id=? AND clinician_id=?
                       AND conversation_id=? AND case_id=? AND revision=?""",
                    (
                        revision.scope.tenant_id, revision.scope.clinician_id,
                        revision.scope.conversation_id, revision.scope.case_id,
                        revision.revision,
                    ),
                ).fetchone()
                encoded = _encode_fact_set(revision.fact_set)
                expected_existing = (
                    revision.knowledge_release_id,
                    revision.terminology_release_id,
                    encoded,
                )
                if existing_revision is not None and existing_revision != expected_existing:
                    raise ClinicalKernelError(
                        KernelErrorDetail(KernelErrorCode.REVISION_CONFLICT, "revision changed during commit")
                    )
                if existing_revision is None:
                    connection.execute(
                        """INSERT INTO case_revisions VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                        (
                            revision.scope.tenant_id, revision.scope.clinician_id,
                            revision.scope.conversation_id, revision.scope.case_id,
                            revision.revision, revision.knowledge_release_id,
                            revision.terminology_release_id, encoded,
                        ),
                    )
                connection.execute(
                    "INSERT INTO idempotency_records VALUES (?, ?, ?)",
                    (idempotency.request_id, idempotency.input_fingerprint, idempotency.plan_fingerprint),
                )
                connection.commit()
            except ClinicalKernelError:
                connection.rollback()
                raise
            except sqlite3.Error as exc:
                connection.rollback()
                raise ClinicalKernelError(
                    KernelErrorDetail(KernelErrorCode.PERSISTENCE_FAILURE, str(exc), retryable=True)
                ) from exc
