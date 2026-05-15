import type { ReviewRiskLevel } from "./types";

const RISK_ORDER: Record<ReviewRiskLevel, number> = {
  unknown: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function normalizeReviewRiskLevel(value: string | undefined): ReviewRiskLevel {
  if (value === "low" || value === "medium" || value === "high" || value === "critical") return value;
  return "unknown";
}

export function isRiskAtLeast(value: ReviewRiskLevel, minimum: ReviewRiskLevel): boolean {
  return RISK_ORDER[value] >= RISK_ORDER[minimum];
}
