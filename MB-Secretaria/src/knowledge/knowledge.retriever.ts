import { Injectable } from '@nestjs/common';
import { KnowledgeIndexService } from './knowledge-index.service';
import { MedicalSourcesService } from './medical-sources.service';
import { MedicalCitation, RetrievedMedicalDocument } from './types';

const RETRIEVAL_CACHE_TTL_MS = 10 * 60_000;

interface RetrievalCacheEntry {
  expiresAt: number;
  docs: RetrievedMedicalDocument[];
}

@Injectable()
export class KnowledgeRetriever {
  private readonly cache = new Map<string, RetrievalCacheEntry>();

  constructor(
    private readonly sourcesService: MedicalSourcesService,
    private readonly indexService: KnowledgeIndexService,
  ) {}

  async retrieve(
    query: string,
    topK = 6,
    country = 'US',
  ): Promise<{ context: string; docs: RetrievedMedicalDocument[]; citations: MedicalCitation[] }> {
    const cacheKey = `${query.toLowerCase()}|${country.toUpperCase()}|${topK}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return {
        context: this.buildContext(cached.docs),
        docs: cached.docs,
        citations: this.toCitations(cached.docs),
      };
    }

    let docs = await this.indexService.searchTopK(query, topK);

    // If corpus is sparse, pull fresh trusted sources and re-index.
    if (docs.length < Math.max(3, Math.floor(topK / 2))) {
      const fetched = await this.sourcesService.fetchTrustedDocuments(query, country, 8);
      if (fetched.length > 0) {
        await this.indexService.upsertDocuments(fetched);
      }
      docs = await this.indexService.searchTopK(query, topK);
    }

    // Rule: prioritize official clinical guidelines when available.
    docs = docs.sort((a, b) => {
      const aGuideline = a.source === 'guideline' ? 1 : 0;
      const bGuideline = b.source === 'guideline' ? 1 : 0;
      if (aGuideline !== bGuideline) return bGuideline - aGuideline;
      const priorityDelta = b.sourcePriority - a.sourcePriority;
      if (priorityDelta !== 0) return priorityDelta;
      return b.similarity - a.similarity;
    });

    this.cache.set(cacheKey, {
      expiresAt: Date.now() + RETRIEVAL_CACHE_TTL_MS,
      docs,
    });

    return {
      context: this.buildContext(docs),
      docs,
      citations: this.toCitations(docs),
    };
  }

  private buildContext(docs: RetrievedMedicalDocument[]): string {
    if (!docs.length) return '';

    return docs
      .map((d, i) => {
        const snippet = d.abstract.slice(0, 500);
        return [
          `[DOC_${i + 1}]`,
          `source=${d.source}`,
          `date=${d.date}`,
          `title=${d.title}`,
          `url=${d.url}`,
          `summary=${snippet}`,
        ].join('\n');
      })
      .join('\n\n');
  }

  private toCitations(docs: RetrievedMedicalDocument[]): MedicalCitation[] {
    return docs.map((d) => ({
      source: d.source,
      url: d.url,
      title: d.title,
      date: d.date,
    }));
  }
}
