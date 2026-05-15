import { Injectable } from '@nestjs/common';
import { IncidentPayload } from '../../common/types/brain.types';

@Injectable()
export class ScheduleValidator {
  normalize(input: IncidentPayload): IncidentPayload {
    return {
      ...input,
      metadata: {
        ...input.metadata,
        scheduleCheckedAt: new Date().toISOString(),
      },
    };
  }
}
