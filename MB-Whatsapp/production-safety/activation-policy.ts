import type { ActivationPolicy, ProductionLayer } from "./types";

const DOCS_BY_LAYER: Record<ProductionLayer, string[]> = {
  semantic_memory: ["MEMORY_LAYER_VALIDATION.md", "MEMORY_SECURITY_MODEL.md", "MEMORY_ROLLBACK_PLAN.md"],
  medical_vision: ["IMAGE_PIPELINE_VALIDATION.md", "IMAGE_SAFETY_MODEL.md", "IMAGE_ROLLBACK_PLAN.md"],
  provider_router: ["PROVIDER_ROUTER_VALIDATION.md", "PROVIDER_SECURITY_MODEL.md", "PROVIDER_ROLLBACK_PLAN.md"],
  human_review: ["HUMAN_REVIEW_VALIDATION.md", "HUMAN_REVIEW_SAFETY_MODEL.md", "HUMAN_REVIEW_ROLLBACK_PLAN.md"],
  clinical_confidence: ["CLINICAL_CONFIDENCE_VALIDATION.md", "CLINICAL_CONFIDENCE_SAFETY_MODEL.md", "CLINICAL_CONFIDENCE_ROLLBACK_PLAN.md"],
  observability: ["OBSERVABILITY_VALIDATION.md", "OBSERVABILITY_SAFETY_MODEL.md", "OBSERVABILITY_ROLLBACK_PLAN.md"],
  production_safety: ["PRODUCTION_SAFETY_VALIDATION.md", "PRODUCTION_SAFETY_MODEL.md", "PRODUCTION_SAFETY_ROLLBACK_PLAN.md"],
};

const FLAGS_BY_LAYER: Record<ProductionLayer, string[]> = {
  semantic_memory: ["AI_RUNTIME_ENABLED", "SEMANTIC_MEMORY_ENABLED"],
  medical_vision: ["AI_RUNTIME_ENABLED", "MEDICAL_VISION_ENABLED", "HUMAN_REVIEW_ENABLED"],
  provider_router: ["AI_RUNTIME_ENABLED", "LLM_PROVIDER_ROUTER_ENABLED"],
  human_review: ["AI_RUNTIME_ENABLED", "HUMAN_REVIEW_ENABLED"],
  clinical_confidence: ["AI_RUNTIME_ENABLED", "CLINICAL_CONFIDENCE_ENABLED"],
  observability: ["AI_RUNTIME_ENABLED", "OBSERVABILITY_ENABLED"],
  production_safety: ["AI_RUNTIME_ENABLED"],
};

export function buildActivationPolicy(layer: ProductionLayer): ActivationPolicy {
  return {
    layer,
    can_activate: false,
    required_flags: FLAGS_BY_LAYER[layer],
    required_documents: DOCS_BY_LAYER[layer],
    required_validations: ["typecheck", "build", "rollback_drill", "clinical_safety_review", "phi_review"],
    forbidden_in_production: true,
    reason: ["fase_9_policy_is_pre_activation_only", "runtime_integration_not_authorized"],
  };
}
