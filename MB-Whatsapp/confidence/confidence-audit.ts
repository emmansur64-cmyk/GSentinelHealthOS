import type { ClinicalConfidenceResult, ConfidenceAuditEvent } from "./types";

export function createConfidenceAuditEvent(result: ClinicalConfidenceResult): ConfidenceAuditEvent {
  return {
    trace_id: result.trace_id,
    confidence_score: result.confidence_score,
    uncertainty_score: result.uncertainty_score,
    hallucination_risk: result.hallucination_risk.risk_level,
    escalation_recommended: result.escalation_recommended,
    safe_to_display: result.safe_to_display,
    provider_conflicts: result.provider_consistency.unresolved_conflicts,
    multimodal_conflicts: result.multimodal_conflict_detected ? result.escalation_reason.filter((reason) => reason.includes("multimodal")) : [],
    created_at: new Date().toISOString(),
  };
}

export class InMemoryConfidenceAuditSink {
  private events: ConfidenceAuditEvent[] = [];

  append(event: ConfidenceAuditEvent): void {
    this.events.push(event);
  }

  list(): ConfidenceAuditEvent[] {
    return [...this.events];
  }
}
