import type { ReviewStatus } from "./types";

export const REVIEW_STATUSES: ReviewStatus[] = [
  "PENDING_REVIEW",
  "UNDER_REVIEW",
  "ESCALATED",
  "APPROVED",
  "REJECTED",
  "OVERRIDDEN",
  "AUTO_BLOCKED",
  "REQUIRES_SPECIALIST",
  "CLOSED",
];

export function isTerminalReviewStatus(status: ReviewStatus): boolean {
  return status === "APPROVED" || status === "REJECTED" || status === "OVERRIDDEN" || status === "CLOSED";
}
