import { Injectable } from '@nestjs/common';
import { SecretaryAdministrativePayload } from '../../common/types/secretaria.types';

@Injectable()
export class BookingValidator {
  normalize(input: SecretaryAdministrativePayload): SecretaryAdministrativePayload {
    const source = typeof input.source === 'string' ? input.source.trim() : String(input.source ?? '');
    const message = typeof input.message === 'string' ? input.message.trim() : String(input.message ?? '');
    return { ...input, source, message };
  }
}
