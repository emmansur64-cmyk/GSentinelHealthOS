import { describe, expect, it } from '@jest/globals';
import { BookingRules } from './rules/booking.rules';
import { DataRules } from './rules/data.rules';
import { SafetyRules } from './rules/safety.rules';
import { BookingValidator } from './validators/booking.validator';
import { ScheduleValidator } from './validators/schedule.validator';
import { GuardService } from './guard.service';

describe('GuardService administrative secretary contracts', () => {
  const service = new GuardService(
    new BookingRules(),
    new DataRules(),
    new SafetyRules(),
    new BookingValidator(),
    new ScheduleValidator(),
  );

  it('permite payload administrativo valido', () => {
    const verdict = service.validate({
      id: 'row-1',
      source: 'secretary_spreadsheet_preview',
      message: 'preview schedule rows before agenda apply',
      timestamp: '2026-05-15T12:00:00.000Z',
      metadata: { tenantId: 'tenant-a' },
    });

    expect(verdict.allowed).toBe(true);
    expect(verdict.reasons).toEqual([]);
  });

  it('bloquea payload administrativo inseguro antes de Agenda API', () => {
    const verdict = service.validate({
      id: 'row-2',
      source: 'secretary_spreadsheet_preview',
      message: 'DROP TABLE appointments',
      timestamp: '2026-05-15T12:00:00.000Z',
      metadata: { tenantId: 'tenant-a' },
    });

    expect(verdict.allowed).toBe(false);
    expect(verdict.reasons).toContain('unsafe_payload_detected:sql_injection');
  });
});
