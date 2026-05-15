import type { ClinicalTraceContext, CurrentImplementationAdapter, SafeFallback } from "../core";

export type ClinicalRuleDecision = {
  action: string;
  confidence: number;
  reasons: string[];
  requiresHumanReview: boolean;
};

export type ClinicalRulesEngine = {
  evaluate(input: {
    text?: string;
    context?: Record<string, unknown>;
    trace: ClinicalTraceContext;
  }): Promise<SafeFallback<ClinicalRuleDecision>>;
};

export const CURRENT_CLINICAL_RULES_ADAPTER: CurrentImplementationAdapter = {
  layer: "clinical_rules_engine",
  currentPaths: [
    "src/guard",
    "src/brain/strategies",
    "services/decision_service/app/rules.py",
    "medical-agenda-saas/src/lib/metabrain.ts",
  ],
  behaviorChanging: false,
  notes: ["Fase 2 solo declara frontera; no mueve reglas existentes."],
};
