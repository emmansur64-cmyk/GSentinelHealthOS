from .types import ActivationPolicy, ProductionLayer

DOCS_BY_LAYER: dict[ProductionLayer, list[str]] = {
    "semantic_memory": ["MEMORY_LAYER_VALIDATION.md", "MEMORY_SECURITY_MODEL.md", "MEMORY_ROLLBACK_PLAN.md"],
    "medical_vision": ["IMAGE_PIPELINE_VALIDATION.md", "IMAGE_SAFETY_MODEL.md", "IMAGE_ROLLBACK_PLAN.md"],
    "provider_router": ["PROVIDER_ROUTER_VALIDATION.md", "PROVIDER_SECURITY_MODEL.md", "PROVIDER_ROLLBACK_PLAN.md"],
    "human_review": ["HUMAN_REVIEW_VALIDATION.md", "HUMAN_REVIEW_SAFETY_MODEL.md", "HUMAN_REVIEW_ROLLBACK_PLAN.md"],
    "clinical_confidence": ["CLINICAL_CONFIDENCE_VALIDATION.md", "CLINICAL_CONFIDENCE_SAFETY_MODEL.md", "CLINICAL_CONFIDENCE_ROLLBACK_PLAN.md"],
    "observability": ["OBSERVABILITY_VALIDATION.md", "OBSERVABILITY_SAFETY_MODEL.md", "OBSERVABILITY_ROLLBACK_PLAN.md"],
    "production_safety": ["PRODUCTION_SAFETY_VALIDATION.md", "PRODUCTION_SAFETY_MODEL.md", "PRODUCTION_SAFETY_ROLLBACK_PLAN.md"],
}


def build_activation_policy(layer: ProductionLayer) -> ActivationPolicy:
    return ActivationPolicy(
        layer=layer,
        can_activate=False,
        required_flags=["AI_RUNTIME_ENABLED"],
        required_documents=DOCS_BY_LAYER[layer],
        required_validations=["typecheck", "build", "rollback_drill", "clinical_safety_review", "phi_review"],
        forbidden_in_production=True,
        reason=["fase_9_policy_is_pre_activation_only", "runtime_integration_not_authorized"],
    )
