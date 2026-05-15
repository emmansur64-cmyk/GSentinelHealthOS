import type { ClinicalReviewCase, ReviewAuditEvent, ReviewDecision, ReviewStatus } from "./types";

export function createReviewAuditEvent(input: {
  reviewCase: ClinicalReviewCase;
  status_before?: ReviewStatus;
  status_after: ReviewStatus;
  decision?: ReviewDecision;
  blocked?: boolean;
}): ReviewAuditEvent {
  return {
    review_id: input.reviewCase.review_id,
    trace_id: input.reviewCase.trace_id,
    reviewer_id: input.decision?.reviewer_id,
    status_before: input.status_before,
    status_after: input.status_after,
    escalation_level: input.reviewCase.escalation_level,
    override_used: input.decision?.decision === "override",
    blocked: input.blocked ?? input.status_after === "AUTO_BLOCKED",
    created_at: new Date().toISOString(),
  };
}

export class InMemoryReviewAuditSink {
  private events: ReviewAuditEvent[] = [];

  append(event: ReviewAuditEvent): void {
    this.events.push(event);
  }

  list(): ReviewAuditEvent[] {
    return [...this.events];
  }
}
