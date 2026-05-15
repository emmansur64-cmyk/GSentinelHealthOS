export type ProductionLayer =
  | "semantic_memory"
  | "medical_vision"
  | "provider_router"
  | "human_review"
  | "clinical_confidence"
  | "observability"
  | "production_safety";

export type ProductionSafetyConfig = {
  ai_runtime_enabled: boolean;
  shadow_mode: boolean;
  dry_run: boolean;
  kill_switch: boolean;
  safe_fallback: boolean;
  blocking_enabled: boolean;
  enabled_layers: ProductionLayer[];
  disabled_layers: ProductionLayer[];
  external_calls_allowed: boolean;
  phi_allowed: boolean;
  created_at: string;
};

export type RuntimeGuardResult = {
  allowed: boolean;
  blocked_reason: string[];
  active_flags: Record<string, boolean>;
  disabled_layers: ProductionLayer[];
  safe_fallback_required: boolean;
  dry_run: boolean;
  shadow_mode: boolean;
  audit_ref: string;
  created_at: string;
};

export type HealthCheckResult = {
  layer: ProductionLayer;
  status: "healthy" | "disabled" | "shadow" | "dry_run" | "blocked" | "warning";
  enabled: boolean;
  shadow_mode: boolean;
  degraded: boolean;
  errors: string[];
  warnings: string[];
  checked_at: string;
};

export type ActivationPolicy = {
  layer: ProductionLayer;
  can_activate: boolean;
  required_flags: string[];
  required_documents: string[];
  required_validations: string[];
  forbidden_in_production: boolean;
  reason: string[];
};

export type RollbackRegistryEntry = {
  layer: ProductionLayer;
  rollback_doc: string;
  files_created: string[];
  files_modified: string[];
  flags_to_disable: string[];
  safe_revert_notes: string[];
};

export type StartupValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  guard: RuntimeGuardResult;
  health: HealthCheckResult[];
  created_at: string;
};

export type EnvValidationResult = {
  ok: boolean;
  missing_flags: string[];
  dangerous_flags: string[];
  warnings: string[];
  checked_at: string;
};
