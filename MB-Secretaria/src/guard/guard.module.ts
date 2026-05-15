import { Module } from '@nestjs/common';
import { BookingRules } from './rules/booking.rules';
import { DataRules } from './rules/data.rules';
import { SafetyRules } from './rules/safety.rules';
import { BookingValidator } from './validators/booking.validator';
import { ScheduleValidator } from './validators/schedule.validator';
import { GuardService } from './guard.service';

@Module({
  providers: [GuardService, BookingRules, DataRules, SafetyRules, BookingValidator, ScheduleValidator],
  exports: [GuardService],
})
export class GuardModule {}
