export type ReviewStatus =
  | "PENDING_REVIEW"
  | "UNDER_REVIEW"
  | "ESCALATED"
  | "APPROVED"
  | "REJECTED"
  | "OVERRIDDEN"
  | "AUTO_BLOCKED"
  | "REQUIRES_SPECIALIST"
  | "CLOSED";

export type ReviewRiskLevel = "low" | "medium" | "high" | "critical" | "unknown";
export type ReviewModality = "text" | "image" | "multimodal" | "unknown";
export type EscalationLevel = "none" | "routine" | "urgent" | "specialist" | "blocked";

export type ClinicalReviewCase = {
  review_id: string;
  trace_id: string;
  tenant_id: string;
  doctor_id?: string;
  patient_id?: string;
  source_layer: string;
  request_type: string;
  modality: ReviewModality;
  risk_level: ReviewRiskLevel;
  confidence_score: number;
  uncertainty_score: number;
  requires_review: boolean;
  review_reason: string[];
  ai_output_summary: string;
  provider: string;
  escalation_level: EscalationLevel;
  status: ReviewStatus;
  created_at: string;
  updated_at: string;
};

export type ReviewDecision = {
  reviewer_id: string;
  decision: "approve" | "reject" | "override" | "close" | "request_specialist";
  notes: string;
  override_reason?: string;
  reviewed_at: string;
};

export type ReviewEscalation = {
  escalation_level: EscalationLevel;
  escalation_reason: string[];
  target_specialty?: string;
  requires_specialist: boolean;
  auto_blocked: boolean;
};

export type ReviewAuditEvent = {
  review_id: string;
  trace_id: string;
  reviewer_id?: string;
  status_before?: ReviewStatus;
  status_after: ReviewStatus;
  escalation_level: EscalationLevel;
  override_used: boolean;
  blocked: boolean;
  created_at: string;
};

export type HumanReviewFlags = {
  enabled: boolean;
  shadowMode: boolean;
  blockingEnabled: boolean;
  imageRequired: boolean;
  lowConfidenceRequired: boolean;
  multimodalRequired: boolean;
  highRiskRequired: boolean;
  overrideEnabled: boolean;
};

export type ReviewPolicy = {
  lowConfidenceThreshold: number;
  highUncertaintyThreshold: number;
  highRiskLevels: ReviewRiskLevel[];
  specialistRiskLevels: ReviewRiskLevel[];
};

export type ConfidenceGateInput = {
  trace_id: string;
  tenant_id: string;
  doctor_id?: string;
  patient_id?: string;
  source_layer: string;
  request_type: string;
  modality: ReviewModality;
  risk_level: ReviewRiskLevel;
  confidence_score?: number;
  uncertainty_score?: number;
  provider?: string;
  ai_output_summary?: string;
  provider_conflict?: boolean;
  hallucination_risk?: boolean;
  target_specialty?: string;
};

export type ConfidenceGateResult = {
  requires_review: boolean;
  would_require_review: boolean;
  review_reason: string[];
  escalation: ReviewEscalation;
  blocked: boolean;
  unsafe_to_display: boolean;
  shadow_mode: boolean;
};

export type BlockingResult = {
  blocked: boolean;
  unsafe_to_display: boolean;
  requires_override: boolean;
  shadow_block_recommended: boolean;
  reason: string[];
};
