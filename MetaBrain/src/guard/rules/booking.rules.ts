import { Injectable } from '@nestjs/common';
import { IncidentPayload } from '../../common/types/brain.types';

@Injectable()
export class BookingRules {
  evaluate(input: IncidentPayload): string[] {
    const reasons: string[] = [];

    if (input.source.toLowerCase().includes('booking') && !input.metadata?.tenantId) {
      reasons.push('booking_missing_tenant');
    }

    return reasons;
  }
}
