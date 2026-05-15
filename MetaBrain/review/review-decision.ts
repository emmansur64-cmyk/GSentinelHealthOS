import type { ClinicalReviewCase, HumanReviewFlags, ReviewDecision, ReviewStatus } from "./types";

export function statusFromDecision(decision: ReviewDecision, flags: HumanReviewFlags): ReviewStatus {
  if (decision.decision === "approve") return "APPROVED";
  if (decision.decision === "reject") return "REJECTED";
  if (decision.decision === "close") return "CLOSED";
  if (decision.decision === "request_specialist") return "REQUIRES_SPECIALIST";
  if (decision.decision === "override" && flags.overrideEnabled) return "OVERRIDDEN";
  if (decision.decision === "override") return "ESCALATED";
  return "UNDER_REVIEW";
}

export function applyReviewDecision(
  reviewCase: ClinicalReviewCase,
  decision: ReviewDecision,
  flags: HumanReviewFlags,
): ClinicalReviewCase {
  return {
    ...reviewCase,
    status: statusFromDecision(decision, flags),
    updated_at: decision.reviewed_at,
  };
}
