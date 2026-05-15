import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EmbeddingService } from './embedding.service';
import {
  MedicalDocumentEntity,
  MedicalDocumentEntityDocument,
} from './schemas/medical-document.schema';
import { MedicalNormalizedDocument, RetrievedMedicalDocument } from './types';

const SOURCE_PRIORITY: Record<string, number> = {
  guideline: 100,
  who: 90,
  cdc: 85,
  clinicaltrials: 75,
  pubmed: 60,
};

@Injectable()
export class KnowledgeIndexService {
  private readonly logger = new Logger(KnowledgeIndexService.name);

  constructor(
    @InjectModel(MedicalDocumentEntity.name)
    private readonly medicalDocModel: Model<MedicalDocumentEntityDocument>,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async upsertDocuments(docs: MedicalNormalizedDocument[]): Promise<number> {
    let upserted = 0;

    for (const doc of docs) {
      const content = [doc.title, doc.abstract, ...doc.keywords].join(' ').trim();
      if (!content || !doc.url) continue;

      const embedding = this.embeddingService.embed(content);
      const sourcePriority = SOURCE_PRIORITY[doc.source] ?? 50;

      await this.medicalDocModel.updateOne(
        { url: doc.url },
        {
          $set: {
            content,
            embedding,
            source: doc.source,
            title: doc.title,
            abstract: doc.abstract,
            url: doc.url,
            date: doc.date,
            keywords: doc.keywords,
            metadata: {
              externalId: doc.externalId,
              country: doc.country,
              sourcePriority,
              indexedAt: new Date().toISOString(),
            },
          },
        },
        { upsert: true },
      );

      upserted += 1;
    }

    this.logger.log(`[KnowledgeIndex] upserted=${upserted}`);
    return upserted;
  }

  async searchTopK(query: string, topK = 8): Promise<RetrievedMedicalDocument[]> {
    const queryEmbedding = this.embeddingService.embed(query);

    // Alternative to pgvector: compute cosine in app layer over curated corpus.
    const rows = await this.medicalDocModel
      .find({}, { __v: 0 })
      .sort({ 'metadata.sourcePriority': -1, createdAt: -1 })
      .limit(2500)
      .lean<MedicalDocumentEntity[]>();

    const scored = rows
      .map((r) => {
        const similarity = this.embeddingService.cosineSimilarity(queryEmbedding, r.embedding ?? []);
        const sourcePriority = Number(r.metadata?.sourcePriority ?? 50);

        return {
          id: String((r as unknown as { _id?: unknown })._id ?? r.url),
          title: r.title,
          abstract: r.abstract,
          source: r.source,
          url: r.url,
          date: r.date,
          keywords: r.keywords,
          similarity,
          sourcePriority,
        };
      })
      .filter((x) => x.similarity > 0)
      .sort((a, b) => {
        const priorityDelta = b.sourcePriority - a.sourcePriority;
        if (Math.abs(priorityDelta) >= 5) return priorityDelta;
        return b.similarity - a.similarity;
      })
      .slice(0, topK);

    return scored;
  }

  async countDocuments(): Promise<number> {
    return this.medicalDocModel.countDocuments();
  }
}
