export type ConfidenceModality = "text" | "image" | "multimodal" | "unknown";
export type ConfidenceRiskLevel = "low" | "medium" | "high" | "critical" | "unknown";
export type HallucinationRiskLevel = "low" | "medium" | "high" | "critical";
export type ProviderOutputStatus = "ok" | "empty" | "malformed" | "error" | "timeout";

export type ProviderOutputSummary = {
  provider_name: string;
  model_name?: string;
  status: ProviderOutputStatus;
  content_summary?: string;
  confidence_score?: number;
  safety_flags?: string[];
};

export type LayerSummary = {
  available: boolean;
  summary?: string;
  confidence_score?: number;
  conflicts?: string[];
  quality_score?: number;
};

export type ClinicalConfidenceInput = {
  trace_id: string;
  tenant_id: string;
  request_type: string;
  modality: ConfidenceModality;
  provider_outputs: ProviderOutputSummary[];
  memory_context_summary: LayerSummary;
  retrieval_summary: LayerSummary;
  image_summary?: LayerSummary;
  risk_summary: LayerSummary & { risk_level?: ConfidenceRiskLevel };
  review_status?: string;
  metadata?: Record<string, unknown>;
};

export type ProviderConsistencyResult = {
  providers_compared: number;
  consistency_score: number;
  conflicts_detected: boolean;
  dominant_provider?: string;
  unresolved_conflicts: string[];
};

export type HallucinationRisk = {
  risk_level: HallucinationRiskLevel;
  unsupported_claims_detected: boolean;
  evidence_missing: boolean;
  multimodal_inconsistency: boolean;
  provider_divergence: boolean;
  escalation_required: boolean;
};

export type EvidenceEvaluation = {
  evidence_completeness: number;
  missing_evidence: string[];
  conflict_signals: string[];
};

export type MultimodalConflictResult = {
  multimodal_conflict_detected: boolean;
  conflicts: string[];
};

export type SafeDisplayResult = {
  safe_to_display: boolean;
  display_restrictions: string[];
  unsafe_to_display: boolean;
};

export type ClinicalConfidenceResult = {
  trace_id: string;
  confidence_score: number;
  uncertainty_score: number;
  hallucination_risk: HallucinationRisk;
  evidence_completeness: number;
  provider_consistency: ProviderConsistencyResult;
  multimodal_conflict_detected: boolean;
  escalation_recommended: boolean;
  escalation_reason: string[];
  safe_to_display: boolean;
  display_restrictions: string[];
  confidence_explanation: string[];
  audit_ref: string;
  created_at: string;
};

export type ClinicalConfidenceFlags = {
  enabled: boolean;
  shadowMode: boolean;
  blockingEnabled: boolean;
  multimodalEnabled: boolean;
  providerConsistencyEnabled: boolean;
  hallucinationCheckEnabled: boolean;
  safeDisplayEnabled: boolean;
  autoEscalationEnabled: boolean;
};

export type ConfidencePolicy = {
  minimumSafeConfidence: number;
  highUncertaintyThreshold: number;
  minimumEvidenceCompleteness: number;
  minimumProviderConsistency: number;
  highHallucinationRiskThreshold: number;
};

export type ConfidenceAuditEvent = {
  trace_id: string;
  confidence_score: number;
  uncertainty_score: number;
  hallucination_risk: HallucinationRiskLevel;
  escalation_recommended: boolean;
  safe_to_display: boolean;
  provider_conflicts: string[];
  multimodal_conflicts: string[];
  created_at: string;
};
