import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { BrainModule } from '../brain/brain.module';
import { MedicalAssistantController } from './medical-assistant.controller';
import { MedicalAssistantService } from './medical-assistant.service';

@Module({
  imports: [AiModule, BrainModule],
  controllers: [MedicalAssistantController],
  providers: [MedicalAssistantService],
})
export class MedicalAssistantModule {}
