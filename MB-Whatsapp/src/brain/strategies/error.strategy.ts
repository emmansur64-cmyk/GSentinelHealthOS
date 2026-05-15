import { Injectable } from '@nestjs/common';
import { BrainDecision, ErrorFingerprint, IncidentPayload } from '../../common/types/brain.types';

@Injectable()
export class ErrorStrategy {
  decide(input: IncidentPayload, fingerprint: ErrorFingerprint): BrainDecision {
    const isDatabaseTimeout = fingerprint.code === 'DB_CONNECTION_TIMEOUT';

    return {
      strategy: 'error',
      action: isDatabaseTimeout ? 'restart_postgres' : 'retry_with_backoff',
      confidence: isDatabaseTimeout ? 0.82 : fingerprint.code === 'TRANSIENT_SYSTEM_ERROR' ? 0.84 : 0.55,
      reason: `Fallback para error ${fingerprint.code} en ${input.source}`,
    };
  }
}
