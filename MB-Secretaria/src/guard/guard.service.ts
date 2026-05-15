import { Injectable } from '@nestjs/common';
import { BrainDecision, GuardVerdict, IncidentPayload } from '../common/types/brain.types';
import { SAFE_COMMANDS } from '../execution/command.registry';
import { BookingRules } from './rules/booking.rules';
import { DataRules } from './rules/data.rules';
import { SafetyRules } from './rules/safety.rules';
import { BookingValidator } from './validators/booking.validator';
import { ScheduleValidator } from './validators/schedule.validator';

@Injectable()
export class GuardService {
  private static readonly MIN_CONFIDENCE = 0.7;
  private static readonly BOOKING_EVENT_TYPES = new Set(['booking.conflict', 'booking.created']);

  constructor(
    private readonly bookingRules: BookingRules,
    private readonly dataRules: DataRules,
    private readonly safetyRules: SafetyRules,
    private readonly bookingValidator: BookingValidator,
    private readonly scheduleValidator: ScheduleValidator,
  ) {}

  validate(input: IncidentPayload, eventType?: string): GuardVerdict {
    const isBookingEvent = GuardService.BOOKING_EVENT_TYPES.has(eventType ?? '');

    const normalizedInput: IncidentPayload = isBookingEvent
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

  validateDecision(decision: BrainDecision): { allowed: boolean; reasons: string[] } {
    const reasons: string[] = [];

    if (decision.confidence < GuardService.MIN_CONFIDENCE) {
      reasons.push('low_confidence_decision');
    }

    const command = SAFE_COMMANDS[decision.action];
    if (!command) {
      reasons.push('command_not_registered');
    } else {
      if (!command.enabled) {
        reasons.push('command_disabled');
      }

      if (command.risk === 'high') {
        reasons.push('high_risk_command_blocked');
      }
    }

    return {
      allowed: reasons.length === 0,
      reasons,
    };
  }
}
