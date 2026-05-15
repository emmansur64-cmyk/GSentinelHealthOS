import type { ClinicalConfidenceFlags } from "./types";

export const DEFAULT_CLINICAL_CONFIDENCE_FLAGS: ClinicalConfidenceFlags = {
  enabled: false,
  shadowMode: true,
  blockingEnabled: false,
  multimodalEnabled: false,
  providerConsistencyEnabled: true,
  hallucinationCheckEnabled: true,
  safeDisplayEnabled: false,
  autoEscalationEnabled: false,
};

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.trim().toLowerCase() === "true";
}

export function loadClinicalConfidenceFlags(env: NodeJS.ProcessEnv = process.env): ClinicalConfidenceFlags {
  return {
    enabled: readBoolean(env.CLINICAL_CONFIDENCE_ENABLED, DEFAULT_CLINICAL_CONFIDENCE_FLAGS.enabled),
    shadowMode: readBoolean(env.CLINICAL_CONFIDENCE_SHADOW_MODE, DEFAULT_CLINICAL_CONFIDENCE_FLAGS.shadowMode),
    blockingEnabled: readBoolean(
      env.CLINICAL_CONFIDENCE_BLOCKING_ENABLED,
      DEFAULT_CLINICAL_CONFIDENCE_FLAGS.blockingEnabled,
    ),
    multimodalEnabled: readBoolean(
      env.CLINICAL_CONFIDENCE_MULTIMODAL_ENABLED,
      DEFAULT_CLINICAL_CONFIDENCE_FLAGS.multimodalEnabled,
    ),
    providerConsistencyEnabled: readBoolean(
      env.CLINICAL_CONFIDENCE_PROVIDER_CONSISTENCY_ENABLED,
      DEFAULT_CLINICAL_CONFIDENCE_FLAGS.providerConsistencyEnabled,
    ),
    hallucinationCheckEnabled: readBoolean(
      env.CLINICAL_CONFIDENCE_HALLUCINATION_CHECK_ENABLED,
      DEFAULT_CLINICAL_CONFIDENCE_FLAGS.hallucinationCheckEnabled,
    ),
    safeDisplayEnabled: readBoolean(
      env.CLINICAL_CONFIDENCE_SAFE_DISPLAY_ENABLED,
      DEFAULT_CLINICAL_CONFIDENCE_FLAGS.safeDisplayEnabled,
    ),
    autoEscalationEnabled: readBoolean(
      env.CLINICAL_CONFIDENCE_AUTO_ESCALATION_ENABLED,
      DEFAULT_CLINICAL_CONFIDENCE_FLAGS.autoEscalationEnabled,
    ),
  };
}
