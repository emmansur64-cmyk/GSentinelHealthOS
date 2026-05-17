/**
 * AI provider resilience contract for MB-Chat clinical flows.
 * Focus: AiService must not crash and must provide deterministic fallback behavior.
 */
import { AiService } from './ai.service';
import { IncidentPayload, BrainDecision } from '../common/types/brain.types';

describe('AI Provider Failure - resilience contract', () => {
  const configServiceMock = {
    get: jest.fn((key: string) => (key === 'provider' ? 'groq' : undefined)),
  };

  const fallbackProviderMock = {
    generateHint: jest.fn(async () => 'fallback-hint'),
  };

  const knowledgeRetrieverMock = {
    retrieve: jest.fn(async () => ({
      citations: [],
      docs: [],
      context: '',
    })),
  };

  const classificationServiceMock = {
    classifyMessage: jest.fn(() => ({
      role: 'DOCTOR',
      confidence: 0.99,
      signals: { technicalScore: 2, colloquialScore: 0, structureScore: 1 },
    })),
  };

  const medicalImagingServiceMock = {
    analyzeImage: jest.fn(async () => ({
      findings: 'none',
      probability: 0,
      notes: 'none',
    })),
  };

  const medicalGroqProviderMock = {
    run: jest.fn(async () => '{"answer":"ok","citations":[]}'),
  };

  function buildAiService(runAnalysisImpl: (prompt: string) => Promise<any>, generateHintImpl?: () => Promise<string>): AiService {
    const groqProviderMock = {
      runAnalysis: jest.fn(runAnalysisImpl),
      generateHint: jest.fn(generateHintImpl ?? (async () => 'groq-hint')),
    };

    return new AiService(
      configServiceMock as never,
      groqProviderMock as never,
      fallbackProviderMock as never,
      knowledgeRetrieverMock as never,
      classificationServiceMock as never,
      medicalImagingServiceMock as never,
      medicalGroqProviderMock as never,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('analyze: model_decommissioned no crashea y retorna fallback seguro', async () => {
    const ai = buildAiService(async () => {
      throw new Error('GROQ_SKIP:model1:model_decommissioned');
    });

    await expect(ai.analyze('db timeout')).resolves.toEqual({
      rootCause: 'UNKNOWN',
      confidence: 0.1,
      source: 'ai_fallback',
    });
  });

  it('analyze: invalid_json no crashea y retorna fallback seguro', async () => {
    const ai = buildAiService(async () => {
      throw new Error('JSON Parse error');
    });

    await expect(ai.analyze('invalid model output')).resolves.toEqual({
      rootCause: 'UNKNOWN',
      confidence: 0.1,
      source: 'ai_fallback',
    });
  });

  it('analyze: empty_response no crashea y retorna fallback seguro', async () => {
    const ai = buildAiService(async () => {
      throw new Error('GROQ_SKIP:model2:empty_response');
    });

    await expect(ai.analyze('empty response')).resolves.toEqual({
      rootCause: 'UNKNOWN',
      confidence: 0.1,
      source: 'ai_fallback',
    });
  });

  it('suggestEnhancement: falla Groq y usa fallback deterministico', async () => {
    const ai = buildAiService(async () => ({ rootCause: 'ok', confidence: 0.9, source: 'groq' }), async () => {
      throw new Error('Groq unavailable');
    });

    const incident: IncidentPayload = {
      id: 'incident-1',
      source: 'test-system',
      message: 'timeout acquiring db connection',
      timestamp: new Date().toISOString(),
      metadata: {},
    };

    const decision: BrainDecision = {
      strategy: 'error',
      action: 'retry_with_backoff',
      confidence: 0.6,
      reason: 'test',
    };

    await expect(ai.suggestEnhancement(incident, decision)).resolves.toBe('fallback-hint');
    expect(fallbackProviderMock.generateHint).toHaveBeenCalled();
  });

  it('answerMedicalQuestion: con imagen devuelve informe asistido aunque no haya citas RAG', async () => {
    const ai = buildAiService(async () => ({ rootCause: 'ok', confidence: 0.9, source: 'groq' }));

    await expect(
      ai.answerMedicalQuestion(
        'Interpretar estudio de torax',
        'AR',
        6,
        'aGVsbG8=',
        'image/png',
        61,
        'RX',
        'DOCTOR',
      ),
    ).resolves.toEqual(expect.objectContaining({
      role: 'DOCTOR',
      citations: [],
      imaging: expect.objectContaining({
        findings: 'none',
      }),
      answer: expect.stringContaining('Informe preliminar asistido de imagen medica'),
    }));
  });
});
