import type { ProviderFeatureFlags } from "./types";

export const DEFAULT_PROVIDER_FLAGS: ProviderFeatureFlags = {
  routerEnabled: false,
  shadowMode: true,
  fallbackEnabled: false,
  healthcheckEnabled: true,
  structuredOutputEnabled: false,
  multimodalEnabled: false,
  externalImageEnabled: false,
  phiAllowed: false,
};

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return fallback;
}

export function loadProviderFlags(env: Record<string, string | undefined> = process.env): ProviderFeatureFlags {
  return {
    routerEnabled: readBoolean(env.LLM_PROVIDER_ROUTER_ENABLED, DEFAULT_PROVIDER_FLAGS.routerEnabled),
    shadowMode: readBoolean(env.LLM_PROVIDER_SHADOW_MODE, DEFAULT_PROVIDER_FLAGS.shadowMode),
    fallbackEnabled: readBoolean(env.LLM_PROVIDER_FALLBACK_ENABLED, DEFAULT_PROVIDER_FLAGS.fallbackEnabled),
    healthcheckEnabled: readBoolean(env.LLM_PROVIDER_HEALTHCHECK_ENABLED, DEFAULT_PROVIDER_FLAGS.healthcheckEnabled),
    structuredOutputEnabled: readBoolean(
      env.LLM_PROVIDER_STRUCTURED_OUTPUT_ENABLED,
      DEFAULT_PROVIDER_FLAGS.structuredOutputEnabled,
    ),
    multimodalEnabled: readBoolean(env.LLM_PROVIDER_MULTIMODAL_ENABLED, DEFAULT_PROVIDER_FLAGS.multimodalEnabled),
    externalImageEnabled: readBoolean(
      env.LLM_PROVIDER_EXTERNAL_IMAGE_ENABLED,
      DEFAULT_PROVIDER_FLAGS.externalImageEnabled,
    ),
    phiAllowed: readBoolean(env.LLM_PROVIDER_PHI_ALLOWED, DEFAULT_PROVIDER_FLAGS.phiAllowed),
  };
}

export const DOCUMENTED_PROVIDER_FLAGS = {
  LLM_PROVIDER_ROUTER_ENABLED: "false",
  LLM_PROVIDER_SHADOW_MODE: "true",
  LLM_PROVIDER_FALLBACK_ENABLED: "false",
  LLM_PROVIDER_HEALTHCHECK_ENABLED: "true",
  LLM_PROVIDER_STRUCTURED_OUTPUT_ENABLED: "false",
  LLM_PROVIDER_MULTIMODAL_ENABLED: "false",
  LLM_PROVIDER_EXTERNAL_IMAGE_ENABLED: "false",
  LLM_PROVIDER_PHI_ALLOWED: "false",
} as const;
