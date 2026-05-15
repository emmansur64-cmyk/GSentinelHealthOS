import { Module } from '@nestjs/common';
import { ActionEffectivenessAnalyzer } from './analyzers/action-effectiveness.analyzer';
import { LearningService } from './learning.service';
import { PersistenceModule } from '../persistence/persistence.module';

@Module({
  imports: [PersistenceModule],
  providers: [LearningService, ActionEffectivenessAnalyzer],
  exports: [LearningService],
})
export class LearningModule {}
