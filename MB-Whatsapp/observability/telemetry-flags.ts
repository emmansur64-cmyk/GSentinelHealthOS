import type { ObservabilityFlags } from "./types";

export const DEFAULT_OBSERVABILITY_FLAGS: ObservabilityFlags = {
  enabled: false,
  shadowMode: true,
  structuredLoggingEnabled: false,
  traceEngineEnabled: false,
  providerMetricsEnabled: false,
  confidenceMetricsEnabled: false,
  reviewMetricsEnabled: false,
  multimodalMetricsEnabled: false,
  externalExportEnabled: false,
  phiAllowed: false,
};

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.trim().toLowerCase() === "true";
}

export function loadObservabilityFlags(env: NodeJS.ProcessEnv = process.env): ObservabilityFlags {
  return {
    enabled: readBoolean(env.OBSERVABILITY_ENABLED, DEFAULT_OBSERVABILITY_FLAGS.enabled),
    shadowMode: readBoolean(env.OBSERVABILITY_SHADOW_MODE, DEFAULT_OBSERVABILITY_FLAGS.shadowMode),
    structuredLoggingEnabled: readBoolean(env.OBSERVABILITY_STRUCTURED_LOGGING_ENABLED, DEFAULT_OBSERVABILITY_FLAGS.structuredLoggingEnabled),
    traceEngineEnabled: readBoolean(env.OBSERVABILITY_TRACE_ENGINE_ENABLED, DEFAULT_OBSERVABILITY_FLAGS.traceEngineEnabled),
    providerMetricsEnabled: readBoolean(env.OBSERVABILITY_PROVIDER_METRICS_ENABLED, DEFAULT_OBSERVABILITY_FLAGS.providerMetricsEnabled),
    confidenceMetricsEnabled: readBoolean(env.OBSERVABILITY_CONFIDENCE_METRICS_ENABLED, DEFAULT_OBSERVABILITY_FLAGS.confidenceMetricsEnabled),
    reviewMetricsEnabled: readBoolean(env.OBSERVABILITY_REVIEW_METRICS_ENABLED, DEFAULT_OBSERVABILITY_FLAGS.reviewMetricsEnabled),
    multimodalMetricsEnabled: readBoolean(env.OBSERVABILITY_MULTIMODAL_METRICS_ENABLED, DEFAULT_OBSERVABILITY_FLAGS.multimodalMetricsEnabled),
    externalExportEnabled: readBoolean(env.OBSERVABILITY_EXTERNAL_EXPORT_ENABLED, DEFAULT_OBSERVABILITY_FLAGS.externalExportEnabled),
    phiAllowed: readBoolean(env.OBSERVABILITY_PHI_ALLOWED, DEFAULT_OBSERVABILITY_FLAGS.phiAllowed),
  };
}
