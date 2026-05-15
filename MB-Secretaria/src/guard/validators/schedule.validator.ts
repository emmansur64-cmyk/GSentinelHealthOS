import { Injectable } from '@nestjs/common';
import { SecretaryAdministrativePayload } from '../../common/types/secretaria.types';

@Injectable()
export class ScheduleValidator {
  normalize(input: SecretaryAdministrativePayload): SecretaryAdministrativePayload {
    return {
      ...input,
      metadata: {
        ...input.metadata,
        scheduleCheckedAt: new Date().toISOString(),
      },
    };
  }
}
