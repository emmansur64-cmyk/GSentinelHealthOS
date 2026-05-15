import { Injectable } from '@nestjs/common';
import { ExecutionResult, IncidentPayload } from '../../common/types/brain.types';

@Injectable()
export class RollbackExecutor {
  async execute(input: IncidentPayload): Promise<ExecutionResult> {
    return {
      success: true,
      action: 'rollback_last_change',
      details: `Rollback preventivo ejecutado para ${input.id}`,
      rollbackSuggested: false,
    };
  }
}
