import {
  BrainDecision,
  ExecutionResult,
  IncidentPayload,
  MlPredictionTrace,
} from '../../common/types/brain.types';

export interface IncidentMemoryRecord {
  incident: IncidentPayload;
  decision: BrainDecision;
  result: ExecutionResult;
  prediction?: MlPredictionTrace;
  realOutcome?: 'success' | 'failure' | 'blocked' | 'simulated';
  storedAt: string;
}
