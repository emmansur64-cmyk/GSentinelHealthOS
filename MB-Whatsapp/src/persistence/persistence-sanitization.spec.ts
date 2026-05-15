import { PersistenceService } from './persistence.service';

describe('PersistenceService sanitization', () => {
  it('does not pass original sensitive values to online training persistence', async () => {
    const created: unknown[] = [];
    const model = { create: jest.fn((doc) => { created.push(doc); return Promise.resolve(doc); }) };

    const service = new PersistenceService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      model as never,
    );

    await service.saveOnlineTrainingRecord(
      'incident-1',
      'clinical-chat',
      {
        message: 'Paciente email patient@example.com telefono +54 11 5555-1234',
        metadata: {
          authorization: 'Bearer real-token',
          image_base64: 'abc123',
        },
      },
      { score: 1 },
      [1, 2, 3],
      ['score'],
      { raw: 'token=abc123456789' },
      'retry_with_backoff',
      0.91,
      'test',
    );

    const doc = created[0] as {
      input: { message: string; metadata: { authorization: string; image_base64: string } };
      mlPrediction: { raw: string };
    };

    expect(doc.input.message).not.toContain('patient@example.com');
    expect(doc.input.message).not.toContain('5555-1234');
    expect(doc.input.metadata.authorization).toBe('[REDACTED]');
    expect(doc.input.metadata.image_base64).toBe('[REDACTED]');
    expect(doc.mlPrediction.raw).toBe('[REDACTED]');
  });
});
