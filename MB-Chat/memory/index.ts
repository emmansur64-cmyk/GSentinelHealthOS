export * from "./types";
export * from "./feature-flags";
export * from "./memory-sanitizer";
export * from "./memory-audit";
export * from "./memory-retriever";
export * from "./jsonl-memory-adapter";
export * from "./semantic-memory-service";
export * from "./vector-backend.contract";

export const SEMANTIC_MEMORY_LAYER_STATUS = {
  phase: "phase_3_controlled_semantic_memory",
  defaultEnabled: false,
  defaultShadowMode: true,
  activeBackend: "jsonl_compatibility_adapter",
  vectorBackend: "contract_only",
  runtimeConnected: false,
  behaviorChange: false,
} as const;
