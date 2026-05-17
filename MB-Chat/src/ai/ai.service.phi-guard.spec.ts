import { AiService } from './ai.service';
import { ProviderPhiNotAllowedError } from './assert-groq-phi-guard';

describe('AiService PHI Guard negative tests', () => {
  const configServiceMock = {
    get: jest.fn(() => 'groq'),
  };

  const groqProviderMock = {
    runAnalysis: jest.fn(async () => ({ rootCause: 'ok', confidence: 0.9, source: 'groq' })),
    generateHint: jest.fn(async () => 'ok'),
  };

  const medicalGroqProviderMock = {
    run: jest.fn(async () => '{"answer":"ok","citations":[]}'),
  };

  const fallbackProviderMock = {
    generateHint: jest.fn(async () => 'fallback'),
  };

  const knowledgeRetrieverMock = {
    retrieve: jest.fn(async () => ({
      citations: [
        {
          source: 'guideline',
          url: 'https://example.org/guide',
          title: 'Guide',
          date: '2026-01-01',
        },
      ],
      docs: [
        {
          title: 'Guide',
          source: 'guideline',
          date: '2026-01-01',
          content: 'content',
        },
      ],
      context: 'Contexto clinico de prueba',
    })),
  };

  const classificationServiceMock = {
    classifyMessage: jest.fn(() => ({
      role: 'PATIENT',
      confidence: 0.95,
      signals: { technicalScore: 0, colloquialScore: 1, structureScore: 0 },
    })),
  };

  const medicalImagingServiceMock = {
    analyzeImage: jest.fn(async () => ({
      findings: 'none',
      probability: 0.1,
      notes: 'none',
    })),
  };

  const buildService = () =>
    new AiService(
      configServiceMock as never,
      groqProviderMock as never,
      fallbackProviderMock as never,
      knowledgeRetrieverMock as never,
      classificationServiceMock as never,
      medicalImagingServiceMock as never,
      medicalGroqProviderMock as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('analyze bloquea PHI y no llama al provider Groq', async () => {
    const service = buildService();
    await expect(
      service.analyze('Paciente Juan Perez DNI 12345678 con dolor toracico', 'corr-1'),
    ).rejects.toBeInstanceOf(ProviderPhiNotAllowedError);
    expect(groqProviderMock.runAnalysis).not.toHaveBeenCalled();
  });

  it('refineMedicalText bloquea PHI y no llama al provider medico Groq', async () => {
    const service = buildService();
    await expect(
      service.refineMedicalText('Historia clinica: paciente Maria Lopez con telefono 555-1234', 'corr-2'),
    ).rejects.toBeInstanceOf(ProviderPhiNotAllowedError);
    expect(medicalGroqProviderMock.run).not.toHaveBeenCalled();
  });

  it('answerMedicalQuestion bloquea PHI y no llama al provider medico Groq', async () => {
    const service = buildService();
    await expect(
      service.answerMedicalQuestion(
        'Paciente Pedro Gomez DNI 99887766 con fiebre alta',
        'AR',
        6,
        undefined,
        undefined,
        34,
        'rx',
        'DOCTOR',
        undefined,
        undefined,
        'corr-3',
      ),
    ).rejects.toBeInstanceOf(ProviderPhiNotAllowedError);
    expect(medicalGroqProviderMock.run).not.toHaveBeenCalled();
  });

  it('answerMedicalQuestion permite resumen clinico minimo sanitizado', async () => {
    const service = buildService();
    await expect(
      service.answerMedicalQuestion(
        'Manejo inicial de sepsis en guardia',
        'AR',
        6,
        undefined,
        undefined,
        undefined,
        undefined,
        'DOCTOR',
        undefined,
        'Resumen sanitizado: paciente adulto con fiebre y taquicardia, sin identificadores.',
        'corr-4',
      ),
    ).resolves.toEqual(expect.objectContaining({
      role: 'DOCTOR',
    }));
    expect(medicalGroqProviderMock.run).toHaveBeenCalled();
  });
});
