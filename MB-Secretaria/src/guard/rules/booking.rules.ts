import { Injectable } from '@nestjs/common';
import { SecretaryAdministrativePayload } from '../../common/types/secretaria.types';

@Injectable()
export class BookingRules {
  evaluate(input: SecretaryAdministrativePayload): string[] {
    const reasons: string[] = [];

    if (input.source.toLowerCase().includes('booking') && !input.metadata?.tenantId) {
      reasons.push('booking_missing_tenant');
    }

    return reasons;
  }
}
