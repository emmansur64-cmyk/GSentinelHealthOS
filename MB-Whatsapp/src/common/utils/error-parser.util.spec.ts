import { describe, expect, it } from '@jest/globals';
import { IncidentPayload } from '../types/brain.types';
import { extractErrorFingerprint } from './error-parser.util';

describe('extractErrorFingerprint', () => {
  it('detecta DB_CONNECTION_TIMEOUT por correlacion multi-evento', () => {
    const input: IncidentPayload = {
      id: 'inc-1',
      source: 'scheduler',
      message: 'Unexpected failure',
      timestamp: new Date().toISOString(),
      metadata: {
        errors: ['Read timeout while waiting for dependency'],
        logs: ['postgres connection pool exhausted'],
      },
    };

    const fingerprint = extractErrorFingerprint(input);

    expect(fingerprint.code).toBe('DB_CONNECTION_TIMEOUT');
    expect(fingerprint.summary).toContain('Postgres');
  });
});
