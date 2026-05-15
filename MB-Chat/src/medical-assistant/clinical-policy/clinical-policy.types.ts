export type ClinicalSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type ClinicalActorRole = 'PATIENT' | 'DOCTOR' | 'ADMIN';

export type ClinicalAssistantMode = 'doctor_professional' | 'clinical_support';

export type ClinicalPolicyStage = 'pre' | 'post' | 'error';

export interface ClinicalPolicyContext {
  requestId: string;
  stage: ClinicalPolicyStage;
  query: string;
  role: ClinicalActorRole;
  mode: ClinicalAssistantMode;
  channel?: string;
  modality: 'text' | 'image' | 'multimodal';
  responseText?: string;
  providerErrorClass?: string;
}

export interface ClinicalPolicyResult {
  policyName: string;
  triggered: boolean;
  severity: ClinicalSeverity;
  shortCircuit?: boolean;
  responseText?: string;
  warnings?: string[];
  transformedText?: string;
  flags?: Partial<ClinicalPolicyFlags>;
}

export interface ClinicalPolicyFlags {
  skipPatientTriage: boolean;
  applyPatientFacingBoundaries: boolean;
}

export interface ClinicalPolicy {
  readonly name: string;
  evaluate(context: ClinicalPolicyContext): ClinicalPolicyResult;
}

export interface ClinicalPolicyEvaluationResult {
  decision: 'continue' | 'short_circuit';
  severity: ClinicalSeverity;
  responseText?: string;
  transformedText?: string;
  warnings: string[];
  triggeredPolicies: string[];
  flags: ClinicalPolicyFlags;
}
