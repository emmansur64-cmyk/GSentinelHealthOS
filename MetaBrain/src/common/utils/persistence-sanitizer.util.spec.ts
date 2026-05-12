import { sanitizeForPersistence } from './persistence-sanitizer.util';

describe('sanitizeForPersistence', () => {
  it('redacts nested secrets and PII while preserving object shape', () => {
    const sanitized = sanitizeForPersistence({
      user: {
        email: 'patient@example.com',
        phone: '+54 11 5555-1234',
        nested: {
          token: 'secret-token-value',
          note: 'dni 12345678 and password=super-secret',
        },
      },
    });

    expect(sanitized.user.email).toBe('[REDACTED]');
    expect(sanitized.user.phone).toBe('[REDACTED]');
    expect(sanitized.user.nested.token).toBe('[REDACTED]');
    expect(sanitized.user.nested.note).not.toContain('12345678');
    expect(sanitized.user.nested.note).not.toContain('super-secret');
  });

  it('redacts image_base64 payloads before persistence', () => {
    const sanitized = sanitizeForPersistence({
      input: {
        modality: 'XRAY',
        image_base64: 'iVBORw0KGgoAAAANSUhEUgAAAAUA',
      },
    });

    expect(sanitized.input.modality).toBe('XRAY');
    expect(sanitized.input.image_base64).toBe('[REDACTED]');
  });
});
