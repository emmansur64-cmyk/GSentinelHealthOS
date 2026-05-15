export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface IncidentPayload {
  id: string;
  source: string;
  message: string;
  stack?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface ErrorFingerprint {
  code: string;
  category: 'booking' | 'schedule' | 'data' | 'unknown';
  summary: string;
}

export type CommandId =
  | 'restart_postgres'
  | 'restart_api'
  | 'clear_cache'
  | 'reconcile_booking_slots'
  | 'rollback_last_change'
  | 'retry_with_backoff'
  | 'normalize_schedule_window';

export interface BrainDecision {
  strategy: 'booking' | 'schedule' | 'error';
  action: CommandId;
  confidence: number;
  reason: string;
}

export type ActionType = 'SYSTEM' | 'BUSINESS';

export interface ActionEnvelope {
  type: ActionType;
  command: CommandId;
  payload: Record<string, unknown>;
}

export interface GuardVerdict {
  allowed: boolean;
  reasons: string[];
  normalizedInput: IncidentPayload;
}

export type IncidentStatus = 'SUCCESS' | 'BLOCKED' | 'FALLBACK' | 'EXECUTED' | 'SIMULATED';

export interface GatedExecutionResult {
  executed: boolean;
  reason: string;
  output: string;
  error: string | null;
  simulated: boolean;
  rollbackHint: string;
}

export interface IncidentResult {
  status: IncidentStatus;
  action: string;
  reason: string;
  execution: GatedExecutionResult | null;
  meta: Record<string, unknown>;
}

export interface AiAnalysisResult {
  rootCause: string;
  confidence: number;
  source: string;
}

export interface ExecutionResult {
  success: boolean;
  action: CommandId;
  details: string;
  rollbackSuggested: boolean;
}

export interface MlTopFeatureTrace {
  feature: string;
  value: number;
  importance: number;
  contributionScore: number;
}

export interface MlPredictionTrace {
  modelAction: CommandId;
  modelConfidence: number;
  rulesAction: CommandId;
  rulesConfidence: number;
  combinedScore: number;
  winnerAction: CommandId;
  winnerSource: 'ml' | 'rules';
  learningBoost: number;
  inferenceMs?: number;
  modelSource?: 'ML' | 'HYBRID' | 'RULES';
  features: Record<string, number>;
  onnxFeatureVector?: number[];
  topFeatures?: MlTopFeatureTrace[];
  dlAnomalyScore?: number;
  dlThreshold?: number;
  dlIsAnomaly?: boolean;
  dlSequenceLength?: number;
  dlSequenceEventIds?: string[];
  dlOverrideApplied?: boolean;
}

export interface AuditRecord {
  incidentId: string;
  source: string;
  decision: BrainDecision;
  result: ExecutionResult;
  createdAt: string;
}

export interface ProcessAuditRecord {
  incidentId: string;
  source: string;
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED';
  diagnosisCode?: string;
  decisionAction?: CommandId;
  actionType?: ActionType;
  prediction?: MlPredictionTrace;
  realOutcome?: 'success' | 'failure' | 'blocked' | 'simulated';
  error?: string;
  createdAt: string;
}
