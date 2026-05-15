import { Injectable } from '@nestjs/common';
import { BrainDecision, ErrorFingerprint, IncidentPayload } from '../../common/types/brain.types';

@Injectable()
export class ScheduleStrategy {
  decide(input: IncidentPayload, fingerprint: ErrorFingerprint): BrainDecision {
    return {
      strategy: 'schedule',
      action: 'normalize_schedule_window',
      confidence: 0.88,
      reason: `${fingerprint.summary} en flujo ${input.source}`,
    };
  }
}
