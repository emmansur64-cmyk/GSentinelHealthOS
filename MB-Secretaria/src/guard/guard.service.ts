import { Injectable } from '@nestjs/common';
import {
  SecretaryAdministrativePayload,
  SecretaryGuardVerdict,
} from '../common/types/secretaria.types';
import { BookingRules } from './rules/booking.rules';
import { DataRules } from './rules/data.rules';
import { SafetyRules } from './rules/safety.rules';
import { BookingValidator } from './validators/booking.validator';
import { ScheduleValidator } from './validators/schedule.validator';

@Injectable()
export class GuardService {
  private static readonly BOOKING_EVENT_TYPES = new Set(['booking.conflict', 'booking.created']);

  constructor(
    private readonly bookingRules: BookingRules,
    private readonly dataRules: DataRules,
    private readonly safetyRules: SafetyRules,
    private readonly bookingValidator: BookingValidator,
    private readonly scheduleValidator: ScheduleValidator,
  ) {}

  validate(input: SecretaryAdministrativePayload, eventType?: string): SecretaryGuardVerdict {
    const isBookingEvent = GuardService.BOOKING_EVENT_TYPES.has(eventType ?? '');

    const normalizedInput: SecretaryAdministrativePayload = isBookingEvent
      ? this.scheduleValidator.normalize(this.bookingValidator.normalize(input))
      : { ...input };

    const reasons: string[] = [
      ...this.dataRules.evaluate(normalizedInput),
      ...this.safetyRules.evaluate(normalizedInput),
      ...(isBookingEvent ? this.bookingRules.evaluate(normalizedInput) : []),
    ];

    return {
      allowed: reasons.length === 0,
      reasons,
      normalizedInput,
    };
  }
}
