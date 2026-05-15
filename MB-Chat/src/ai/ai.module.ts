import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { FallbackProvider } from './providers/fallback.provider';
import { GroqProvider } from './providers/groq.provider';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AiController } from './ai.controller';
import { ClassificationService } from './classification.service';
import { MedicalImagingService } from './medical-imaging.service';

@Module({
  imports: [KnowledgeModule],
  controllers: [AiController],
  providers: [AiService, GroqProvider, FallbackProvider, ClassificationService, MedicalImagingService],
  exports: [AiService],
})
export class AiModule {}
