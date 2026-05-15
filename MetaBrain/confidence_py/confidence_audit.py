from __future__ import annotations

from datetime import UTC, datetime

from .types import ClinicalConfidenceResult, ConfidenceAuditEvent


def create_confidence_audit_event(result: ClinicalConfidenceResult) -> ConfidenceAuditEvent:
    return ConfidenceAuditEvent(
        trace_id=result.trace_id,
        confidence_score=result.confidence_score,
        uncertainty_score=result.uncertainty_score,
        hallucination_risk=result.hallucination_risk.risk_level,
        escalation_recommended=result.escalation_recommended,
        safe_to_display=result.safe_to_display,
        provider_conflicts=result.provider_consistency.unresolved_conflicts,
        multimodal_conflicts=[reason for reason in result.escalation_reason if "multimodal" in reason],
        created_at=datetime.now(UTC).isoformat(),
    )


class InMemoryConfidenceAuditSink:
    def __init__(self) -> None:
        self._events: list[ConfidenceAuditEvent] = []

    def append(self, event: ConfidenceAuditEvent) -> None:
        self._events.append(event)

    def list(self) -> list[ConfidenceAuditEvent]:
        return list(self._events)
