import type { ClinicalTraceContext, CurrentImplementationAdapter, SafeFallback } from "../core";

export type RiskAssessmentInput = {
  features?: Record<string, number>;
  text?: string;
  modelOutput?: unknown;
  trace: ClinicalTraceContext;
};

export type RiskAssessment = {
  score: number;
  level: "low" | "medium" | "high";
  source: "rules" | "ml" | "hybrid" | "fallback";
  reasons: string[];
};

export type RiskEngine = {
  assess(input: RiskAssessmentInput): Promise<SafeFallback<RiskAssessment>>;
};

export const CURRENT_RISK_ADAPTER: CurrentImplementationAdapter = {
  layer: "risk_engine",
  currentPaths: [
    "src/ml",
    "src/ml-core",
    "src/dl",
    "cerebro_ai_med/models",
    "services/inference_service",
    "services/decision_service",
  ],
  behaviorChanging: false,
  notes: ["Existing ML/DL/rules risk scoring remains unchanged."],
};
