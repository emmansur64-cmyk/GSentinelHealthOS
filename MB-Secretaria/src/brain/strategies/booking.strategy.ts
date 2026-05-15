import { Injectable } from '@nestjs/common';
import { BrainDecision, ErrorFingerprint, IncidentPayload } from '../../common/types/brain.types';

@Injectable()
export class BookingStrategy {
  decide(input: IncidentPayload, fingerprint: ErrorFingerprint): BrainDecision {
    return {
      strategy: 'booking',
      action: 'reconcile_booking_slots',
      confidence: 0.92,
      reason: `${fingerprint.summary} para ${input.source}`,
    };
  }
}
