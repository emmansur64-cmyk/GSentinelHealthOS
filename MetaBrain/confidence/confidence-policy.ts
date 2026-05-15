import type { ConfidencePolicy } from "./types";

export const DEFAULT_CONFIDENCE_POLICY: ConfidencePolicy = {
  minimumSafeConfidence: 0.65,
  highUncertaintyThreshold: 0.7,
  minimumEvidenceCompleteness: 0.55,
  minimumProviderConsistency: 0.6,
  highHallucinationRiskThreshold: 0.7,
};
