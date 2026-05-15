import type { ClinicalReviewCase } from "./types";

export function routeReviewCase(reviewCase: ClinicalReviewCase): { queue: string; target_specialty?: string } {
  if (reviewCase.status === "REQUIRES_SPECIALIST" || reviewCase.escalation_level === "specialist") {
    return { queue: "specialist_review" };
  }

  if (reviewCase.escalation_level === "urgent" || reviewCase.risk_level === "critical") {
    return { queue: "urgent_clinical_review" };
  }

  if (reviewCase.modality === "image" || reviewCase.modality === "multimodal") {
    return { queue: "multimodal_review" };
  }

  return { queue: "clinical_review" };
}
