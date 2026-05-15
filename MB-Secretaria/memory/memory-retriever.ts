import type { MemoryBackend, MemoryEntry, MemorySearchFilters, MemoryScope } from "./types";

export type MemoryRetrieverResult = {
  entries: MemoryEntry[];
  retrieval_mode: "lexical_jsonl";
};

export class MemoryRetriever {
  constructor(private readonly backend: MemoryBackend) {}

  async search(input: {
    query: string;
    scope: MemoryScope;
    filters?: MemorySearchFilters;
  }): Promise<MemoryRetrieverResult> {
    const entries = await this.backend.search({
      text: input.query,
      scope: input.scope,
      filters: input.filters,
    });

    return {
      entries,
      retrieval_mode: "lexical_jsonl",
    };
  }

  async recent(scope: MemoryScope, limit = 20): Promise<MemoryRetrieverResult> {
    return {
      entries: await this.backend.list_recent(scope, limit),
      retrieval_mode: "lexical_jsonl",
    };
  }
}
