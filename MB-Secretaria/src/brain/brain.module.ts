import { Module, forwardRef } from '@nestjs/common';
import { ActionModule } from '../action-engine/action.module';
import { AiModule } from '../ai/ai.module';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';
import { ExecutionModule } from '../execution/execution.module';
import { GuardModule } from '../guard/guard.module';
import { MemoryModule } from '../memory/memory.module';
import { MlModule } from '../ml/ml.module';
import { DlModule } from '../dl/dl.module';
import { SystemBrainModule } from '../system-brain/system-brain.module';
import { LearningModule } from '../learning/learning.module';
import { BrainRouter } from './brain.router';
import { BrainService } from './brain.service';
import { BookingStrategy } from './strategies/booking.strategy';
import { ErrorStrategy } from './strategies/error.strategy';
import { ScheduleStrategy } from './strategies/schedule.strategy';

@Module({
  imports: [
    AiModule,
    GuardModule,
    ActionModule,
    AuditModule,
    MemoryModule,
    forwardRef(() => EventsModule),
    ExecutionModule,
    MlModule,
    DlModule,
    SystemBrainModule,
    LearningModule,
  ],
  providers: [BrainService, BrainRouter, BookingStrategy, ScheduleStrategy, ErrorStrategy],
  exports: [BrainService],
})
export class BrainModule {}
