import { Injectable } from '@nestjs/common';
import { DEFAULT_RETRY_LIMIT } from '../../common/constants/app.constants';
import { ExecutionResult, IncidentPayload } from '../../common/types/brain.types';

@Injectable()
export class RetryExecutor {
  async execute(input: IncidentPayload): Promise<ExecutionResult> {
    return {
      success: true,
      action: 'retry_with_backoff',
      details: `Reintento aplicado con limite ${DEFAULT_RETRY_LIMIT} para ${input.id}`,
      rollbackSuggested: false,
    };
  }
}
