import { sanitizeForPersistence } from './persistence-sanitizer.util';

describe('sanitizeForPersistence', () => {
  it('redacts nested secrets and PII while preserving object shape', () => {
    const sanitized = sanitizeForPersistence({
      user: {
        email: 'patient@example.com',
        nested: {
          token: 'secret-token-value',
          note: 'dni 12345678 and password=super-secret',
        },
      },
    });

    expect(sanitized.user.email).toBe('[REDACTED]');
    expect(sanitized.user.nested.token).toBe('[REDACTED]');
    expect(sanitized.user.nested.note).not.toContain('12345678');
    expect(sanitized.user.nested.note).not.toContain('super-secret');
  });

  it('redacts uploaded document payloads before persistence', () => {
    const sanitized = sanitizeForPersistence({
      input: {
        fileName: 'horarios.xlsx',
        file_base64: 'UEsDBBQAAAAI',
      },
    });

    expect(sanitized.input.fileName).toBe('horarios.xlsx');
    expect(sanitized.input.file_base64).toBe('[REDACTED]');
  });
});
