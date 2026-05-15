import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ModelService } from './model.service';
import { OnlineLearningService } from './online-learning.service';
import { OnlineBufferService } from './online-buffer.service';
import { MlController } from './ml.controller';
import { MlCoreModule } from '../ml-core/ml-core.module';
import { PersistenceModule } from '../persistence/persistence.module';

@Module({
  imports: [MlCoreModule, PersistenceModule, ScheduleModule.forRoot()],
  controllers: [MlController],
  providers: [ModelService, OnlineLearningService, OnlineBufferService],
  exports: [ModelService, OnlineLearningService, OnlineBufferService],
})
export class MlModule {}