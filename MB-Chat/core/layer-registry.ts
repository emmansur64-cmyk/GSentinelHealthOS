import type { CurrentImplementationAdapter } from "./types";

export type RegisteredLayer =
  | "clinical_rules_engine"
  | "retrieval_engine"
  | "semantic_memory"
  | "image_intelligence"
  | "llm_orchestrator"
  | "audit_layer"
  | "risk_engine"
  | "provider_router"
  | "human_review"
  | "clinical_confidence";

export type LayerRegistration = {
  layer: RegisteredLayer;
  directory: string;
  featureFlag?: string;
  defaultEnabled: boolean;
  adapter?: CurrentImplementationAdapter;
};

export const PHASE_2_LAYER_REGISTRY: LayerRegistration[] = [
  { layer: "clinical_rules_engine", directory: "MetaBrain/rules", defaultEnabled: true },
  { layer: "retrieval_engine", directory: "MetaBrain/retrieval", defaultEnabled: true },
  { layer: "semantic_memory", directory: "MetaBrain/memory", featureFlag: "SEMANTIC_MEMORY_ENABLED", defaultEnabled: false },
  { layer: "image_intelligence", directory: "MetaBrain/imaging", featureFlag: "MEDICAL_VISION_ENABLED", defaultEnabled: false },
  { layer: "llm_orchestrator", directory: "MetaBrain/providers", defaultEnabled: true },
  { layer: "audit_layer", directory: "MetaBrain/audit", defaultEnabled: true },
  { layer: "risk_engine", directory: "MetaBrain/risk", defaultEnabled: true },
  { layer: "provider_router", directory: "MetaBrain/providers", featureFlag: "AI_PROVIDER_ROUTER_ENABLED", defaultEnabled: false },
  { layer: "human_review", directory: "MetaBrain/review", featureFlag: "CLINICAL_REVIEW_QUEUE_ENABLED", defaultEnabled: false },
  { layer: "clinical_confidence", directory: "MetaBrain/confidence", featureFlag: "CLINICAL_CONFIDENCE_ENGINE_ENABLED", defaultEnabled: false },
];
