import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  MedicalDocumentEntity,
  MedicalDocumentSchema,
} from './schemas/medical-document.schema';
import { MedicalSourcesService } from './medical-sources.service';
import { EmbeddingService } from './embedding.service';
import { KnowledgeIndexService } from './knowledge-index.service';
import { KnowledgeRetriever } from './knowledge.retriever';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MedicalDocumentEntity.name, schema: MedicalDocumentSchema },
    ]),
  ],
  providers: [
    MedicalSourcesService,
    EmbeddingService,
    KnowledgeIndexService,
    KnowledgeRetriever,
  ],
  exports: [MedicalSourcesService, KnowledgeIndexService, KnowledgeRetriever],
})
export class KnowledgeModule {}
