import { GroqSecretariaService } from './groq-secretaria.service';
import { getGroqSecretariaConfig } from './groq-secretaria.config';

describe('GroqSecretariaService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY_SECRETARIA;
    delete process.env.GROQ_MODEL_SECRETARIA;
  });

  it('solo queda configurado con GROQ_API_KEY_SECRETARIA y GROQ_MODEL_SECRETARIA', () => {
    process.env.GROQ_API_KEY = 'generic-key';
    process.env.GROQ_MODEL_SECRETARIA = 'secretaria-model';

    expect(getGroqSecretariaConfig()).toMatchObject({
      enabled: false,
      apiKey: '',
      apiKeyEnv: 'GROQ_API_KEY_SECRETARIA',
      model: 'secretaria-model',
    });

    process.env.GROQ_API_KEY_SECRETARIA = 'secretaria-key';

    expect(getGroqSecretariaConfig()).toMatchObject({
      enabled: true,
      apiKey: 'secretaria-key',
      apiKeyEnv: 'GROQ_API_KEY_SECRETARIA',
      model: 'secretaria-model',
      modelEnv: 'GROQ_MODEL_SECRETARIA',
    });
  });

  it('mapea encabezados administrativos con chat/completions de Groq', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                Profesional: 'doctorName',
                Dia: 'dayOfWeek',
                'Hora desde': 'startTime',
              }),
            },
          },
        ],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new GroqSecretariaService({
      enabled: true,
      apiKey: 'secretaria-key',
      apiKeyEnv: 'GROQ_API_KEY_SECRETARIA',
      model: 'secretaria-model',
      modelEnv: 'GROQ_MODEL_SECRETARIA',
      baseUrl: 'https://api.groq.com/openai/v1',
      timeoutMs: 3000,
    });

    await expect(service.resolveHeaderAliases(['Profesional', 'Dia', 'Hora desde'])).resolves.toEqual({
      Profesional: 'doctorName',
      Dia: 'dayOfWeek',
      'Hora desde': 'startTime',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer secretaria-key',
        }),
      }),
    );
  });
});
