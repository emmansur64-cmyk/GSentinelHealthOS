import type { ReviewPolicy } from "./types";

export const DEFAULT_REVIEW_POLICY: ReviewPolicy = {
  lowConfidenceThreshold: 0.6,
  highUncertaintyThreshold: 0.7,
  highRiskLevels: ["high", "critical"],
  specialistRiskLevels: ["critical"],
};
