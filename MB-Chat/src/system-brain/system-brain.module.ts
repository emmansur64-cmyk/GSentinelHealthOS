import { Module } from '@nestjs/common';
import { LearningModule } from '../learning/learning.module';
import { MemoryModule } from '../memory/memory.module';
import { FrequencyAnalyzer } from './analyzers/frequency.analyzer';
import { PatternAnalyzer } from './analyzers/pattern.analyzer';
import { SystemBrainService } from './system-brain.service';

@Module({
  imports: [MemoryModule, LearningModule],
  providers: [SystemBrainService, FrequencyAnalyzer, PatternAnalyzer],
  exports: [SystemBrainService],
})
export class SystemBrainModule {}
