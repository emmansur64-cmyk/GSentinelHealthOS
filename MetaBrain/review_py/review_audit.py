from __future__ import annotations

from datetime import UTC, datetime

from .types import ClinicalReviewCase, ReviewAuditEvent, ReviewDecision, ReviewStatus


def create_review_audit_event(
    review_case: ClinicalReviewCase,
    status_after: ReviewStatus,
    status_before: ReviewStatus | None = None,
    decision: ReviewDecision | None = None,
    blocked: bool | None = None,
) -> ReviewAuditEvent:
    return ReviewAuditEvent(
        review_id=review_case.review_id,
        trace_id=review_case.trace_id,
        reviewer_id=decision.reviewer_id if decision else None,
        status_before=status_before,
        status_after=status_after,
        escalation_level=review_case.escalation_level,
        override_used=bool(decision and decision.decision == "override"),
        blocked=bool(blocked if blocked is not None else status_after == "AUTO_BLOCKED"),
        created_at=datetime.now(UTC).isoformat(),
    )


class InMemoryReviewAuditSink:
    def __init__(self) -> None:
        self._events: list[ReviewAuditEvent] = []

    def append(self, event: ReviewAuditEvent) -> None:
        self._events.append(event)

    def list(self) -> list[ReviewAuditEvent]:
        return list(self._events)
