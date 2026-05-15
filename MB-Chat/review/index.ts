import type { CurrentImplementationAdapter } from "../core";

export * from "./types";
export * from "./review-audit";
export * from "./review-blocking";
export * from "./review-confidence-gate";
export * from "./review-decision";
export * from "./review-escalation";
export * from "./review-flags";
export * from "./review-policy";
export * from "./review-queue";
export * from "./review-reasons";
export * from "./review-risk";
export * from "./review-routing";
export * from "./review-status";

export const CURRENT_HUMAN_REVIEW_ADAPTER: CurrentImplementationAdapter = {
  layer: "human_review",
  currentPaths: [
    "MetaBrain/review",
    "MetaBrain/review_py",
    "medical-agenda-saas/src/lib/compliance/clinical-records",
    "medical-agenda-saas/prisma/schema.prisma:ClinicalRecord",
    "medical-agenda-saas/prisma/schema.prisma:AiImageAnalysisLog",
  ],
  behaviorChanging: false,
  notes: [
    "Fase 6 creates a parallel typed Human Review layer.",
    "No runtime enforcement, endpoint, database, or provider integration is enabled.",
    "Feature flags are documented with enforcement disabled by default.",
  ],
};
