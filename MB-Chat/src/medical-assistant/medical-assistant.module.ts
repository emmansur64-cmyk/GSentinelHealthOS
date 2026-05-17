import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { MedicalAssistantController } from './medical-assistant.controller';
import { MedicalChatLearningService } from './learning/medical-chat-learning.service';
import { MedicalAssistantService } from './medical-assistant.service';
import { MedicalRuntimeToolsService } from './tools/medical-runtime-tools.service';
import { MedicalChatSecurityBoundariesModule } from './adapters/security-boundaries.module';
import { DiagnosisModule } from '../diagnosis/diagnosis.module';
import { PersistenceModule } from '../persistence/persistence.module';

@Module({
  imports: [
    AiModule,
    DiagnosisModule,
    PersistenceModule,
    // REMOVED: BrainModule (replaced with MedicalChatBrainAdapter for boundary enforcement)
    MedicalChatSecurityBoundariesModule,
  ],
  controllers: [MedicalAssistantController],
  providers: [MedicalAssistantService, MedicalRuntimeToolsService, MedicalChatLearningService],
})
export class MedicalAssistantModule {}
