import { describe, expect, it } from '@jest/globals';
import { BrainDecision } from '../common/types/brain.types';
import { BookingRules } from './rules/booking.rules';
import { DataRules } from './rules/data.rules';
import { SafetyRules } from './rules/safety.rules';
import { BookingValidator } from './validators/booking.validator';
import { ScheduleValidator } from './validators/schedule.validator';
import { GuardService } from './guard.service';

describe('GuardService decision security contracts', () => {
  const service = new GuardService(
    new BookingRules(),
    new DataRules(),
    new SafetyRules(),
    new BookingValidator(),
    new ScheduleValidator(),
  );

  it('bloquea por confidence menor a 0.7', () => {
    const decision: BrainDecision = {
      strategy: 'error',
      action: 'retry_with_backoff',
      confidence: 0.69,
      reason: 'test low confidence',
    };

    const verdict = service.validateDecision(decision);

    expect(verdict.allowed).toBe(false);
    expect(verdict.reasons).toContain('low_confidence_decision');
  });

  it('bloquea comandos con riesgo high', () => {
    const decision: BrainDecision = {
      strategy: 'error',
      action: 'clear_cache',
      confidence: 0.95,
      reason: 'test high risk command',
    };

    const verdict = service.validateDecision(decision);

    expect(verdict.allowed).toBe(false);
    expect(verdict.reasons).toContain('high_risk_command_blocked');
  });
});
