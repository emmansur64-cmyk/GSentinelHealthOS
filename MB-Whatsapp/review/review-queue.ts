import { createReviewAuditEvent, InMemoryReviewAuditSink } from "./review-audit";
import { applyReviewDecision } from "./review-decision";
import { isTerminalReviewStatus } from "./review-status";
import type { ClinicalReviewCase, HumanReviewFlags, ReviewAuditEvent, ReviewDecision, ReviewStatus } from "./types";

export class InMemoryClinicalReviewQueue {
  private cases = new Map<string, ClinicalReviewCase>();

  constructor(private readonly auditSink = new InMemoryReviewAuditSink()) {}

  enqueue(reviewCase: ClinicalReviewCase): { queued: boolean; review_id: string; audit_event: ReviewAuditEvent } {
    this.cases.set(reviewCase.review_id, reviewCase);
    const auditEvent = createReviewAuditEvent({ reviewCase, status_after: reviewCase.status });
    this.auditSink.append(auditEvent);
    return { queued: true, review_id: reviewCase.review_id, audit_event: auditEvent };
  }

  get(review_id: string): ClinicalReviewCase | undefined {
    return this.cases.get(review_id);
  }

  list(status?: ReviewStatus): ClinicalReviewCase[] {
    const values = [...this.cases.values()];
    return status ? values.filter((reviewCase) => reviewCase.status === status) : values;
  }

  updateStatus(review_id: string, status: ReviewStatus): ClinicalReviewCase | undefined {
    const current = this.cases.get(review_id);
    if (!current || isTerminalReviewStatus(current.status)) return current;
    const updated = { ...current, status, updated_at: new Date().toISOString() };
    this.cases.set(review_id, updated);
    this.auditSink.append(createReviewAuditEvent({ reviewCase: updated, status_before: current.status, status_after: status }));
    return updated;
  }

  applyDecision(review_id: string, decision: ReviewDecision, flags: HumanReviewFlags): ClinicalReviewCase | undefined {
    const current = this.cases.get(review_id);
    if (!current) return undefined;
    const updated = applyReviewDecision(current, decision, flags);
    this.cases.set(review_id, updated);
    this.auditSink.append(
      createReviewAuditEvent({
        reviewCase: updated,
        status_before: current.status,
        status_after: updated.status,
        decision,
      }),
    );
    return updated;
  }

  auditEvents(): ReviewAuditEvent[] {
    return this.auditSink.list();
  }
}
