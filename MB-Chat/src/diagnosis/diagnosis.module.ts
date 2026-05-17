import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { DiagnosisService } from './diagnosis.service';

@Module({
  imports: [AiModule],
  providers: [DiagnosisService],
  exports: [DiagnosisService],
})
export class DiagnosisModule {}
