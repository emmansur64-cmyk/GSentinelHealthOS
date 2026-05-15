from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime

from .review_audit import InMemoryReviewAuditSink, create_review_audit_event
from .review_decision import apply_review_decision
from .review_status import is_terminal_review_status
from .types import ClinicalReviewCase, HumanReviewFlags, ReviewAuditEvent, ReviewDecision, ReviewStatus


class InMemoryClinicalReviewQueue:
    def __init__(self, audit_sink: InMemoryReviewAuditSink | None = None) -> None:
        self._cases: dict[str, ClinicalReviewCase] = {}
        self._audit_sink = audit_sink or InMemoryReviewAuditSink()

    def enqueue(self, review_case: ClinicalReviewCase) -> dict[str, object]:
        self._cases[review_case.review_id] = review_case
        audit_event = create_review_audit_event(review_case, status_after=review_case.status)
        self._audit_sink.append(audit_event)
        return {"queued": True, "review_id": review_case.review_id, "audit_event": audit_event}

    def get(self, review_id: str) -> ClinicalReviewCase | None:
        return self._cases.get(review_id)

    def list(self, status: ReviewStatus | None = None) -> list[ClinicalReviewCase]:
        values = list(self._cases.values())
        if status is None:
            return values
        return [item for item in values if item.status == status]

    def update_status(self, review_id: str, status: ReviewStatus) -> ClinicalReviewCase | None:
        current = self._cases.get(review_id)
        if current is None or is_terminal_review_status(current.status):
            return current
        updated = replace(current, status=status, updated_at=datetime.now(UTC).isoformat())
        self._cases[review_id] = updated
        self._audit_sink.append(create_review_audit_event(updated, status_after=status, status_before=current.status))
        return updated

    def apply_decision(
        self,
        review_id: str,
        decision: ReviewDecision,
        flags: HumanReviewFlags,
    ) -> ClinicalReviewCase | None:
        current = self._cases.get(review_id)
        if current is None:
            return None
        updated = apply_review_decision(current, decision, flags)
        self._cases[review_id] = updated
        self._audit_sink.append(
            create_review_audit_event(
                updated,
                status_after=updated.status,
                status_before=current.status,
                decision=decision,
            )
        )
        return updated

    def audit_events(self) -> list[ReviewAuditEvent]:
        return self._audit_sink.list()
