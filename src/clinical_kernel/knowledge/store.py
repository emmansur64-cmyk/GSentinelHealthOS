"""Durable activation and rollback under Kernel-owned governance."""

from datetime import date, datetime, timezone
import json
from pathlib import Path
import sqlite3
from threading import RLock
from typing import Protocol

from clinical_kernel.canonical import canonical_json
from clinical_kernel.contracts import Capability
from clinical_kernel.errors import ClinicalKernelError, KernelErrorCode, KernelErrorDetail
from .contracts import (
    ClinicalKnowledgeRelease, ClinicalKnowledgeRule, KnowledgeConflict,
    KnowledgeConflictStatus, KnowledgeEffect, KnowledgeSource, KnowledgeVerificationStatus,
)


class KnowledgeIntegrityVerifier(Protocol):
    def verify(self, *, manifest_hash: str, signature: str) -> bool: ...


class KnowledgeStore(Protocol):
    def active(self) -> ClinicalKnowledgeRelease: ...


def _require_activatable(release: ClinicalKnowledgeRelease, verifier: KnowledgeIntegrityVerifier) -> None:
    try:
        release.validate_structure()
    except ValueError as exc:
        raise ClinicalKernelError(
            KernelErrorDetail(KernelErrorCode.PERSISTENCE_FAILURE, str(exc), field="knowledge_release")
        ) from exc
    if any(rule.verification_status is not KnowledgeVerificationStatus.GOVERNANCE_ACCEPTED for rule in release.rules):
        raise ClinicalKernelError(KernelErrorDetail(KernelErrorCode.INVALID_INPUT, "release contains unaccepted knowledge"))
    if any(conflict.status is KnowledgeConflictStatus.UNRESOLVED for conflict in release.conflicts):
        raise ClinicalKernelError(
            KernelErrorDetail(KernelErrorCode.INVALID_INPUT, "release contains unresolved knowledge conflicts")
        )
    if not verifier.verify(manifest_hash=release.manifest_hash, signature=release.signature):
        raise ClinicalKernelError(KernelErrorDetail(KernelErrorCode.INVALID_INPUT, "knowledge release signature is invalid"))


class InMemoryKnowledgeStore:
    """Thread-safe immutable release registry for tests and ephemeral use."""

    def __init__(self, verifier: KnowledgeIntegrityVerifier) -> None:
        self._verifier = verifier
        self._releases: dict[str, ClinicalKnowledgeRelease] = {}
        self._active_id: str | None = None
        self._activation_history: list[str] = []
        self._lock = RLock()

    def register(self, release: ClinicalKnowledgeRelease) -> None:
        with self._lock:
            try:
                release.validate_structure()
            except ValueError as exc:
                raise ClinicalKernelError(
                    KernelErrorDetail(KernelErrorCode.INVALID_INPUT, str(exc), field="knowledge_release")
                ) from exc
            existing = self._releases.get(release.release_id)
            if existing is not None and existing != release:
                raise ClinicalKernelError(KernelErrorDetail(KernelErrorCode.REVISION_CONFLICT, "knowledge release is immutable"))
            self._releases[release.release_id] = release

    def activate(self, release_id: str) -> None:
        with self._lock:
            release = self._releases.get(release_id)
            if release is None:
                raise ClinicalKernelError(KernelErrorDetail(KernelErrorCode.INVALID_INPUT, "unknown knowledge release"))
            _require_activatable(release, self._verifier)
            if self._active_id is not None and self._active_id != release_id:
                self._activation_history.append(self._active_id)
            self._active_id = release_id

    def active(self) -> ClinicalKnowledgeRelease:
        with self._lock:
            if self._active_id is None:
                raise ClinicalKernelError(
                    KernelErrorDetail(KernelErrorCode.INVALID_INPUT, "no governed knowledge release is active")
                )
            release = self._releases[self._active_id]
            _require_activatable(release, self._verifier)
            return release

    def rollback(self) -> ClinicalKnowledgeRelease:
        with self._lock:
            if not self._activation_history:
                raise ClinicalKernelError(
                    KernelErrorDetail(KernelErrorCode.INVALID_INPUT, "no governed release is available for rollback")
                )
            release = self._releases[self._activation_history.pop()]
            _require_activatable(release, self._verifier)
            self._active_id = release.release_id
            return release


def _release_record(release: ClinicalKnowledgeRelease) -> dict[str, object]:
    return {
        "schema_version": release.schema_version, "release_id": release.release_id,
        "created_at": release.created_at.isoformat(),
        "rules": [rule.canonical_record() for rule in release.rules],
        "sources": [source.canonical_record() for source in release.sources],
        "manifest_hash": release.manifest_hash, "signature": release.signature,
        "conflicts": [conflict.canonical_record() for conflict in release.conflicts],
    }


def _decode_release(payload: str) -> ClinicalKnowledgeRelease:
    try:
        raw = json.loads(payload)
        rules = tuple(ClinicalKnowledgeRule(
            item["rule_id"], item["version"], Capability(item["owner_capability"]),
            KnowledgeEffect(item["effect"]), tuple(item["concept_ids"]), tuple(item["source_ids"]),
            date.fromisoformat(item["valid_from"]),
            None if item["valid_until"] is None else date.fromisoformat(item["valid_until"]),
            KnowledgeVerificationStatus(item["verification_status"]), item["reviewer_id"],
        ) for item in raw["rules"])
        sources = tuple(KnowledgeSource(
            item["source_id"], item["title"], item["canonical_url"], item["publisher"],
            date.fromisoformat(item["publication_date"]), datetime.fromisoformat(item["accessed_at"]),
            item["content_hash"], item["identifier"],
        ) for item in raw["sources"])
        conflicts = tuple(KnowledgeConflict(
            item["conflict_id"], tuple(item["rule_ids"]), KnowledgeConflictStatus(item["status"]),
            item["resolution_rule_id"],
        ) for item in raw["conflicts"])
        release = ClinicalKnowledgeRelease(
            raw["release_id"], datetime.fromisoformat(raw["created_at"]), rules, sources,
            raw["manifest_hash"], raw["signature"], conflicts, raw["schema_version"],
        )
        release.validate_structure()
        return release
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise ClinicalKernelError(
            KernelErrorDetail(KernelErrorCode.PERSISTENCE_FAILURE, "stored knowledge release failed integrity validation")
        ) from exc


class SQLiteKnowledgeStore:
    """Transactional knowledge registry with durable activation receipts."""

    def __init__(self, database_path: str | Path, verifier: KnowledgeIntegrityVerifier) -> None:
        self._path = str(Path(database_path).resolve())
        self._verifier = verifier
        self._lock = RLock()
        with self._connect() as connection:
            connection.executescript("""
                CREATE TABLE IF NOT EXISTS knowledge_releases (
                    release_id TEXT PRIMARY KEY, manifest_hash TEXT NOT NULL, release_json TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS knowledge_state (
                    singleton INTEGER PRIMARY KEY CHECK (singleton=1), active_release_id TEXT,
                    FOREIGN KEY(active_release_id) REFERENCES knowledge_releases(release_id));
                INSERT OR IGNORE INTO knowledge_state(singleton, active_release_id) VALUES (1, NULL);
                CREATE TABLE IF NOT EXISTS activation_history (
                    sequence INTEGER PRIMARY KEY AUTOINCREMENT, previous_release_id TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS activation_receipts (
                    sequence INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL,
                    from_release_id TEXT, to_release_id TEXT NOT NULL,
                    manifest_hash TEXT NOT NULL, occurred_at TEXT NOT NULL);
            """)

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._path, timeout=30.0)
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 30000")
        connection.execute("PRAGMA journal_mode = WAL")
        return connection

    def register(self, release: ClinicalKnowledgeRelease) -> None:
        try:
            release.validate_structure()
            encoded = canonical_json(_release_record(release))
            with self._lock, self._connect() as connection:
                connection.execute("BEGIN IMMEDIATE")
                row = connection.execute(
                    "SELECT manifest_hash, release_json FROM knowledge_releases WHERE release_id=?", (release.release_id,)
                ).fetchone()
                if row is not None and row != (release.manifest_hash, encoded):
                    raise ClinicalKernelError(KernelErrorDetail(KernelErrorCode.REVISION_CONFLICT, "knowledge release is immutable"))
                if row is None:
                    connection.execute("INSERT INTO knowledge_releases VALUES (?, ?, ?)",
                                       (release.release_id, release.manifest_hash, encoded))
                connection.commit()
        except ClinicalKernelError:
            raise
        except (sqlite3.Error, ValueError) as exc:
            raise ClinicalKernelError(
                KernelErrorDetail(KernelErrorCode.PERSISTENCE_FAILURE, str(exc), retryable=isinstance(exc, sqlite3.Error))
            ) from exc

    def _load(self, connection: sqlite3.Connection, release_id: str) -> ClinicalKnowledgeRelease:
        row = connection.execute(
            "SELECT manifest_hash, release_json FROM knowledge_releases WHERE release_id=?", (release_id,)
        ).fetchone()
        if row is None:
            raise ClinicalKernelError(KernelErrorDetail(KernelErrorCode.INVALID_INPUT, "unknown knowledge release"))
        release = _decode_release(row[1])
        if release.manifest_hash != row[0]:
            raise ClinicalKernelError(
                KernelErrorDetail(KernelErrorCode.PERSISTENCE_FAILURE, "stored knowledge manifest index mismatch")
            )
        return release

    def activate(self, release_id: str) -> None:
        with self._lock, self._connect() as connection:
            try:
                connection.execute("BEGIN IMMEDIATE")
                release = self._load(connection, release_id)
                _require_activatable(release, self._verifier)
                current = connection.execute("SELECT active_release_id FROM knowledge_state WHERE singleton=1").fetchone()[0]
                if current == release_id:
                    return
                if current is not None:
                    connection.execute("INSERT INTO activation_history(previous_release_id) VALUES (?)", (current,))
                connection.execute("UPDATE knowledge_state SET active_release_id=? WHERE singleton=1", (release_id,))
                self._receipt(connection, "ACTIVATE", current, release)
                connection.commit()
            except Exception:
                connection.rollback()
                raise

    @staticmethod
    def _receipt(connection: sqlite3.Connection, action: str, previous: str | None,
                 release: ClinicalKnowledgeRelease) -> None:
        connection.execute(
            "INSERT INTO activation_receipts(action,from_release_id,to_release_id,manifest_hash,occurred_at) VALUES (?,?,?,?,?)",
            (action, previous, release.release_id, release.manifest_hash, datetime.now(timezone.utc).isoformat()),
        )

    def active(self) -> ClinicalKnowledgeRelease:
        with self._connect() as connection:
            row = connection.execute("SELECT active_release_id FROM knowledge_state WHERE singleton=1").fetchone()
            if row is None or row[0] is None:
                raise ClinicalKernelError(KernelErrorDetail(KernelErrorCode.INVALID_INPUT, "no governed knowledge release is active"))
            release = self._load(connection, row[0])
        _require_activatable(release, self._verifier)
        return release

    def rollback(self) -> ClinicalKnowledgeRelease:
        with self._lock, self._connect() as connection:
            try:
                connection.execute("BEGIN IMMEDIATE")
                history = connection.execute(
                    "SELECT sequence, previous_release_id FROM activation_history ORDER BY sequence DESC LIMIT 1"
                ).fetchone()
                if history is None:
                    raise ClinicalKernelError(
                        KernelErrorDetail(KernelErrorCode.INVALID_INPUT, "no governed release is available for rollback")
                    )
                release = self._load(connection, history[1])
                _require_activatable(release, self._verifier)
                current = connection.execute("SELECT active_release_id FROM knowledge_state WHERE singleton=1").fetchone()[0]
                connection.execute("UPDATE knowledge_state SET active_release_id=? WHERE singleton=1", (release.release_id,))
                connection.execute("DELETE FROM activation_history WHERE sequence=?", (history[0],))
                self._receipt(connection, "ROLLBACK", current, release)
                connection.commit()
                return release
            except Exception:
                connection.rollback()
                raise
