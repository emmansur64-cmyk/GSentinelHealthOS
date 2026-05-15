from .types import RollbackRegistryEntry


def build_rollback_registry() -> list[RollbackRegistryEntry]:
    return [
        _entry("semantic_memory", "MEMORY_ROLLBACK_PLAN.md", ["MetaBrain/memory", "MetaBrain/memory_py"], ["SEMANTIC_MEMORY_ENABLED", "SEMANTIC_MEMORY_WRITE_ENABLED", "SEMANTIC_MEMORY_VECTOR_ENABLED"]),
        _entry("medical_vision", "IMAGE_ROLLBACK_PLAN.md", ["MetaBrain/imaging", "MetaBrain/imaging_py"], ["MEDICAL_VISION_ENABLED", "DICOM_ENABLED"]),
        _entry("provider_router", "PROVIDER_ROLLBACK_PLAN.md", ["MetaBrain/providers", "MetaBrain/providers_py"], ["LLM_PROVIDER_ROUTER_ENABLED", "LLM_PROVIDER_MULTIMODAL_ENABLED"]),
        _entry("human_review", "HUMAN_REVIEW_ROLLBACK_PLAN.md", ["MetaBrain/review", "MetaBrain/review_py"], ["HUMAN_REVIEW_ENABLED", "HUMAN_REVIEW_BLOCKING_ENABLED"]),
        _entry("clinical_confidence", "CLINICAL_CONFIDENCE_ROLLBACK_PLAN.md", ["MetaBrain/confidence", "MetaBrain/confidence_py"], ["CLINICAL_CONFIDENCE_ENABLED", "CLINICAL_CONFIDENCE_BLOCKING_ENABLED"]),
        _entry("observability", "OBSERVABILITY_ROLLBACK_PLAN.md", ["MetaBrain/observability", "MetaBrain/observability_py"], ["OBSERVABILITY_ENABLED", "OBSERVABILITY_EXTERNAL_EXPORT_ENABLED"]),
        _entry("production_safety", "PRODUCTION_SAFETY_ROLLBACK_PLAN.md", ["MetaBrain/production-safety", "MetaBrain/production_safety_py"], ["AI_RUNTIME_ENABLED"]),
    ]


def _entry(layer, rollback_doc: str, files_created: list[str], flags_to_disable: list[str]) -> RollbackRegistryEntry:
    return RollbackRegistryEntry(layer, rollback_doc, files_created, [], flags_to_disable, ["keep_global_kill_switch_enabled", "do_not_delete_runtime_data", "do_not_restart_services_for_documentation_only"])
