import { Injectable } from '@nestjs/common';
import { BrainDecision, IncidentPayload } from '../../common/types/brain.types';

@Injectable()
export class FallbackProvider {
  async generateHint(input: IncidentPayload, decision: BrainDecision): Promise<string> {
    return `Fallback: ejecutar ${decision.action} y monitorear 15 minutos para ${input.id}`;
  }
}
