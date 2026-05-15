export type ProviderName = "groq" | "openai" | "gemini" | "local" | "future-medical";
export type ProviderRequestType = "chat" | "completion" | "embedding" | "vision" | "multimodal" | "healthcheck";
export type ProviderModality = "text" | "image" | "audio" | "multimodal" | "unknown";
export type ProviderSafetyLevel = "public" | "internal" | "phi_possible" | "phi_blocked";
export type ProviderStatus = "disabled" | "shadowed" | "blocked" | "success" | "fallback" | "timeout" | "error";
export type ProviderHealthStatus = "healthy" | "degraded" | "unavailable" | "disabled";

export type ProviderRequest = {
  trace_id: string;
  tenant_id: string;
  doctor_id?: string;
  patient_id?: string;
  request_type: ProviderRequestType;
  modality: ProviderModality;
  input_text?: string;
  image_reference?: string;
  metadata: Record<string, unknown>;
  safety_level: ProviderSafetyLevel;
  timeout_ms: number;
  structured_output_schema?: Record<string, unknown>;
};

export type ProviderResponse = {
  trace_id: string;
  provider_name: ProviderName | "none";
  model_name: string;
  latency_ms: number;
  status: ProviderStatus;
  content: string;
  structured_output?: unknown;
  confidence_score?: number;
  safety_flags: string[];
  fallback_used: boolean;
  retry_count: number;
  audit_ref: string;
  created_at: string;
};

export type ProviderCapabilities = {
  supports_text: boolean;
  supports_image: boolean;
  supports_multimodal: boolean;
  supports_structured_output: boolean;
  supports_streaming: boolean;
  supports_medical_mode: boolean;
  max_context_tokens: number;
  safe_for_phi: boolean;
};

export type ProviderHealth = {
  provider_name: ProviderName;
  status: ProviderHealthStatus;
  latency_ms: number;
  error_rate: number;
  timeout_rate: number;
  degraded_mode: boolean;
  checked_at: string;
};

export type ProviderAuditEvent = {
  trace_id: string;
  provider: ProviderName | "none";
  model: string;
  request_type: ProviderRequestType;
  modality: ProviderModality;
  latency_ms: number;
  timeout: boolean;
  fallback_used: boolean;
  retry_count: number;
  phi_detected: boolean;
  blocked_by_policy: boolean;
  created_at: string;
};

export type ProviderFeatureFlags = {
  routerEnabled: boolean;
  shadowMode: boolean;
  fallbackEnabled: boolean;
  healthcheckEnabled: boolean;
  structuredOutputEnabled: boolean;
  multimodalEnabled: boolean;
  externalImageEnabled: boolean;
  phiAllowed: boolean;
};

export type ProviderAdapter = {
  readonly provider_name: ProviderName;
  readonly model_name: string;
  readonly capabilities: ProviderCapabilities;
  analyze?(input: ProviderRequest): Promise<ProviderResponse>;
  complete(input: ProviderRequest): Promise<ProviderResponse>;
  healthcheck(): Promise<ProviderHealth>;
};

export type ProviderSelection = {
  provider?: ProviderAdapter;
  blocked: boolean;
  reason?: string;
};
