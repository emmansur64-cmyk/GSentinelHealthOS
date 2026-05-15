import type { CurrentImplementationAdapter } from "../core";

export * from "./types";
export * from "./confidence-audit";
export * from "./confidence-engine";
export * from "./confidence-explainer";
export * from "./confidence-flags";
export * from "./confidence-policy";
export * from "./confidence-score";
export * from "./evidence-evaluator";
export * from "./escalation-recommendation";
export * from "./hallucination-risk";
export * from "./multimodal-conflict";
export * from "./provider-consistency";
export * from "./safe-display";
export * from "./uncertainty-score";

export const CURRENT_CONFIDENCE_ADAPTER: CurrentImplementationAdapter = {
  layer: "clinical_confidence",
  currentPaths: [
    "MetaBrain/confidence",
    "MetaBrain/confidence_py",
    "src/guard",
    "src/brain/brain.service.ts",
    "services/decision_service/app/rules.py",
  ],
  behaviorChanging: false,
  notes: [
    "Fase 7 creates a parallel controlled Clinical Confidence Engine.",
    "No runtime enforcement, endpoint, provider call, or production blocking is enabled.",
    "Existing distributed confidence behavior remains unchanged.",
  ],
};
