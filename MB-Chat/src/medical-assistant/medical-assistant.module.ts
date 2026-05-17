import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { BrainModule } from '../brain/brain.module';
import { MedicalAssistantController } from './medical-assistant.controller';
import { MedicalChatLearningService } from './learning/medical-chat-learning.service';
import { MedicalAssistantService } from './medical-assistant.service';
import { MedicalRuntimeToolsService } from './tools/medical-runtime-tools.service';

@Module({
  imports: [AiModule, BrainModule],
  controllers: [MedicalAssistantController],
  providers: [MedicalAssistantService, MedicalRuntimeToolsService, MedicalChatLearningService],
})
export class MedicalAssistantModule {}
