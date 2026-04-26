import { Injectable } from '@nestjs/common';
import { IncidentPayload } from '../../common/types/brain.types';

@Injectable()
export class DataRules {
  evaluate(input: IncidentPayload): string[] {
    const reasons: string[] = [];

    if (!input.id || !input.message || !input.source || !input.timestamp) {
      reasons.push('required_fields_missing');
    }

    if (input.message.length < 5) {
      reasons.push('message_too_short');
    }

    return reasons;
  }
}
