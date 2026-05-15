import type { MemoryFeatureFlags } from "./types";

export const DEFAULT_MEMORY_FEATURE_FLAGS: MemoryFeatureFlags = {
  enabled: false,
  shadowMode: true,
  vectorEnabled: false,
  writeEnabled: false,
  patientScopeEnabled: false,
};

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) {
    return true;
  }
  if (FALSE_VALUES.has(normalized)) {
    return false;
  }
  return fallback;
}

export function loadMemoryFeatureFlags(
  env: Record<string, string | undefined> = process.env,
): MemoryFeatureFlags {
  return {
    enabled: readBoolean(env.SEMANTIC_MEMORY_ENABLED, DEFAULT_MEMORY_FEATURE_FLAGS.enabled),
    shadowMode: readBoolean(env.SEMANTIC_MEMORY_SHADOW_MODE, DEFAULT_MEMORY_FEATURE_FLAGS.shadowMode),
    vectorEnabled: readBoolean(env.SEMANTIC_MEMORY_VECTOR_ENABLED, DEFAULT_MEMORY_FEATURE_FLAGS.vectorEnabled),
    writeEnabled: readBoolean(env.SEMANTIC_MEMORY_WRITE_ENABLED, DEFAULT_MEMORY_FEATURE_FLAGS.writeEnabled),
    patientScopeEnabled: readBoolean(
      env.SEMANTIC_MEMORY_PATIENT_SCOPE_ENABLED,
      DEFAULT_MEMORY_FEATURE_FLAGS.patientScopeEnabled,
    ),
  };
}

export const DOCUMENTED_MEMORY_FLAGS = {
  SEMANTIC_MEMORY_ENABLED: "false",
  SEMANTIC_MEMORY_SHADOW_MODE: "true",
  SEMANTIC_MEMORY_VECTOR_ENABLED: "false",
  SEMANTIC_MEMORY_WRITE_ENABLED: "false",
  SEMANTIC_MEMORY_PATIENT_SCOPE_ENABLED: "false",
} as const;
