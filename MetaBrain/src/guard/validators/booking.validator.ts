import { Injectable } from '@nestjs/common';
import { IncidentPayload } from '../../common/types/brain.types';

@Injectable()
export class BookingValidator {
  normalize(input: IncidentPayload): IncidentPayload {
    const source = typeof input.source === 'string' ? input.source.trim() : String(input.source ?? '');
    const message = typeof input.message === 'string' ? input.message.trim() : String(input.message ?? '');
    return { ...input, source, message };
  }
}
