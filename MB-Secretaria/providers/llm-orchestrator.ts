import type { ClinicalTraceContext, SafeFallback } from "../core";
import type { ProviderResponse } from "./index";

export type LlmOrchestratorRequest = {
  task: "medical_text" | "ops_hint" | "nlg" | "structured_output";
  prompt: string;
  clinicalContext?: Record<string, unknown>;
  timeoutMs?: number;
  trace: ClinicalTraceContext;
};

export type LlmOrchestrator = {
  complete(input: LlmOrchestratorRequest): Promise<SafeFallback<ProviderResponse>>;
};
