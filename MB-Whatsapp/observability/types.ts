export type ObservabilitySeverity = "debug" | "info" | "warn" | "error" | "critical";
export type ObservabilityLayer =
  | "provider"
  | "memory"
  | "imaging"
  | "review"
  | "confidence"
  | "retrieval"
  | "risk"
  | "rules"
  | "orchestrator"
  | "audit"
  | "system";

export type TraceContext = {
  trace_id: string;
  correlation_id: string;
  parent_trace_id?: string;
  tenant_id: string;
  request_type: string;
  source_layer: string;
  created_at: string;
};

export type ObservabilityEvent = {
  event_id: string;
  trace_id: string;
  correlation_id: string;
  layer: ObservabilityLayer;
  event_type: string;
  severity: ObservabilitySeverity;
  payload_summary: Record<string, unknown>;
  safety_flags: string[];
  created_at: string;
};

export type RequestLineage = {
  trace_id: string;
  providers_used: string[];
  memory_accessed: boolean;
  imaging_used: boolean;
  review_triggered: boolean;
  confidence_generated: boolean;
  escalations: string[];
  fallbacks: string[];
  blocked_outputs: string[];
  final_status: string;
};

export type ProviderMetrics = {
  provider_name: string;
  request_count: number;
  timeout_count: number;
  fallback_count: number;
  latency_avg_ms: number;
  degraded_mode_count: number;
  error_rate: number;
};

export type ConfidenceMetrics = {
  confidence_avg: number;
  uncertainty_avg: number;
  hallucination_flags: number;
  escalation_rate: number;
  safe_display_rate: number;
};

export type ReviewMetrics = {
  pending_reviews: number;
  escalation_count: number;
  override_count: number;
  blocked_outputs: number;
  specialist_required_count: number;
};

export type DriftSignal = {
  layer: ObservabilityLayer;
  signal_type: string;
  severity: ObservabilitySeverity;
  description: string;
  trace_refs: string[];
  detected_at: string;
};

export type ObservabilityAuditEvent = {
  trace_id: string;
  correlation_id: string;
  layers_touched: ObservabilityLayer[];
  providers_involved: string[];
  confidence_generated: boolean;
  review_triggered: boolean;
  escalated: boolean;
  blocked: boolean;
  created_at: string;
};

export type ObservabilityFlags = {
  enabled: boolean;
  shadowMode: boolean;
  structuredLoggingEnabled: boolean;
  traceEngineEnabled: boolean;
  providerMetricsEnabled: boolean;
  confidenceMetricsEnabled: boolean;
  reviewMetricsEnabled: boolean;
  multimodalMetricsEnabled: boolean;
  externalExportEnabled: boolean;
  phiAllowed: boolean;
};

export type HealthSnapshot = {
  status: "healthy" | "degraded" | "critical" | "unknown";
  providers: string[];
  confidence_health: "ok" | "degraded" | "unknown";
  review_pressure: "low" | "medium" | "high";
  escalation_pressure: "low" | "medium" | "high";
  degraded_layers: ObservabilityLayer[];
  drift_alerts: DriftSignal[];
  created_at: string;
};
