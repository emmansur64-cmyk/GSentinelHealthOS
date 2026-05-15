import type { ClinicalTraceContext, CurrentImplementationAdapter, SafeFallback } from "../core";

export type RetrievedEvidence = {
  source: string;
  title: string;
  url?: string;
  snippet: string;
  confidence: number;
};

export type RetrievalEngine = {
  retrieve(input: {
    query: string;
    country?: string;
    topK?: number;
    trace: ClinicalTraceContext;
  }): Promise<SafeFallback<RetrievedEvidence[]>>;
};

export const CURRENT_RETRIEVAL_ADAPTER: CurrentImplementationAdapter = {
  layer: "retrieval_engine",
  currentPaths: ["src/knowledge", "medical-agenda-saas/src/lib/medical-web-retrieval"],
  behaviorChanging: false,
  notes: ["MetaBrain Nest usa embeddings hash; Next usa allowlist y sanitizer."],
};
