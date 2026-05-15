export interface SecretaryAdministrativePayload {
  id: string;
  source: string;
  message: string;
  stack?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface SecretaryGuardVerdict {
  allowed: boolean;
  reasons: string[];
  normalizedInput: SecretaryAdministrativePayload;
}
