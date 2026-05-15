import type { ProductionLayer, RollbackRegistryEntry } from "./types";

export function buildRollbackRegistry(): RollbackRegistryEntry[] {
  return [
    entry("semantic_memory", "MEMORY_ROLLBACK_PLAN.md", ["MetaBrain/memory", "MetaBrain/memory_py"], ["SEMANTIC_MEMORY_ENABLED", "SEMANTIC_MEMORY_WRITE_ENABLED", "SEMANTIC_MEMORY_VECTOR_ENABLED"]),
    entry("medical_vision", "IMAGE_ROLLBACK_PLAN.md", ["MetaBrain/imaging", "MetaBrain/imaging_py"], ["MEDICAL_VISION_ENABLED", "DICOM_ENABLED"]),
    entry("provider_router", "PROVIDER_ROLLBACK_PLAN.md", ["MetaBrain/providers", "MetaBrain/providers_py"], ["LLM_PROVIDER_ROUTER_ENABLED", "LLM_PROVIDER_MULTIMODAL_ENABLED"]),
    entry("human_review", "HUMAN_REVIEW_ROLLBACK_PLAN.md", ["MetaBrain/review", "MetaBrain/review_py"], ["HUMAN_REVIEW_ENABLED", "HUMAN_REVIEW_BLOCKING_ENABLED"]),
    entry("clinical_confidence", "CLINICAL_CONFIDENCE_ROLLBACK_PLAN.md", ["MetaBrain/confidence", "MetaBrain/confidence_py"], ["CLINICAL_CONFIDENCE_ENABLED", "CLINICAL_CONFIDENCE_BLOCKING_ENABLED"]),
    entry("observability", "OBSERVABILITY_ROLLBACK_PLAN.md", ["MetaBrain/observability", "MetaBrain/observability_py"], ["OBSERVABILITY_ENABLED", "OBSERVABILITY_EXTERNAL_EXPORT_ENABLED"]),
    entry("production_safety", "PRODUCTION_SAFETY_ROLLBACK_PLAN.md", ["MetaBrain/production-safety", "MetaBrain/production_safety_py"], ["AI_RUNTIME_ENABLED"]),
  ];
}

function entry(layer: ProductionLayer, rollback_doc: string, files_created: string[], flags_to_disable: string[]): RollbackRegistryEntry {
  return {
    layer,
    rollback_doc,
    files_created,
    files_modified: [],
    flags_to_disable,
    safe_revert_notes: ["keep_global_kill_switch_enabled", "do_not_delete_runtime_data", "do_not_restart_services_for_documentation_only"],
  };
}
