import type { MemoryBackend, MemoryEntry, MemoryScope } from "./types";

export type VectorSearchInput = {
  embedding: number[];
  scope: MemoryScope;
  limit?: number;
  min_score?: number;
};

export type VectorSearchResult = {
  entry: MemoryEntry;
  similarity_score: number;
  backend: "pgvector" | "qdrant" | "local_vector" | "future_provider";
};

export type FutureVectorBackend = MemoryBackend & {
  upsert_vector(entry: MemoryEntry, embedding: number[]): Promise<void>;
  vector_search(input: VectorSearchInput): Promise<VectorSearchResult[]>;
};

export const VECTOR_BACKEND_CONTRACT_STATUS = {
  implemented: false,
  enabledByDefault: false,
  allowedFutureBackends: ["pgvector", "qdrant", "local_vector"],
  note: "Contract only. No vector database dependency or runtime activation is introduced in Phase 3.",
} as const;
