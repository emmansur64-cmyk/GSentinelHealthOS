import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { FallbackProvider } from './providers/fallback.provider';
import { GroqProvider, MEDICAL_GROQ_PROVIDER } from './providers/groq.provider';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AiController } from './ai.controller';
import { ClassificationService } from './classification.service';
import { MedicalImagingService } from './medical-imaging.service';

@Module({
  imports: [KnowledgeModule],
  controllers: [AiController],
  providers: [
    AiService,
    {
      provide: GroqProvider,
      useFactory: () => new GroqProvider('GROQ_API_KEY'),
    },
    {
      provide: MEDICAL_GROQ_PROVIDER,
      useFactory: () => new GroqProvider('GROQ_API_KEY_CHAT'),
    },
    FallbackProvider,
    ClassificationService,
    MedicalImagingService,
  ],
  exports: [AiService],
})
export class AiModule {}
