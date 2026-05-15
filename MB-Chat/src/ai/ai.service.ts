import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiAnalysisResult, BrainDecision, IncidentPayload } from '../common/types/brain.types';
import { FallbackProvider } from './providers/fallback.provider';
import { GroqProvider } from './providers/groq.provider';
import { KnowledgeRetriever } from '../knowledge/knowledge.retriever';
import { MedicalAnswer } from '../knowledge/types';
import { ClassificationService, MedicalUserRole, RoleClassificationResult } from './classification.service';
import { MedicalImagingService } from './medical-imaging.service';
import { buildMedicalTextRefinerPrompt } from './prompts/medical-text-refiner.prompt';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly groqProvider: GroqProvider,
    private readonly fallbackProvider: FallbackProvider,
    private readonly knowledgeRetriever: KnowledgeRetriever,
    private readonly classificationService: ClassificationService,
    private readonly medicalImagingService: MedicalImagingService,
  ) {}

  async suggestEnhancement(input: IncidentPayload, decision: BrainDecision): Promise<string> {
    const selectedProvider = this.configService.get<string>('provider');

    if (selectedProvider === 'groq') {
      try {
        return await this.groqProvider.generateHint(input, decision);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`[AI] Groq hint failed, using deterministic fallback. Reason: ${message.slice(0, 100)}`);
      }
    }

    try {
      return await this.fallbackProvider.generateHint(input, decision);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[AI] Fallback provider also failed: ${message.slice(0, 100)}`);
      return `Fallback unavailable: monitor ${decision.action} on ${input.source}`;
    }
  }

  // Delegates to GroqProvider.runAnalysis which handles model fallback + JSON validation internally.
  // This method NEVER throws — always returns a valid AiAnalysisResult.
  async analyze(prompt: string): Promise<AiAnalysisResult> {
    try {
      return await this.groqProvider.runAnalysis(prompt);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[AI] Unexpected analyze error: ${message.slice(0, 100)}`);
      return { rootCause: 'UNKNOWN', confidence: 0.1, source: 'ai_fallback' };
    }
  }

  classifyMedicalRole(message: string): RoleClassificationResult {
    return this.classificationService.classifyMessage(message);
  }

  async refineMedicalText(inputText: string): Promise<string> {
    const normalized = inputText.trim();

    if (!normalized) {
      return '';
    }

    const prompt = buildMedicalTextRefinerPrompt(normalized);

    try {
      const refined = await this.groqProvider.run(prompt);
      const output = refined.trim();
      return output || normalized;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[AI:refine] fallback to original text: ${message.slice(0, 120)}`);
      return normalized;
    }
  }

  async answerMedicalQuestion(
    query: string,
    country = 'US',
    topK = 6,
    imageBase64?: string,
    imageMimeType?: string,
    patientAge?: number,
    modalityHint?: string,
    roleOverride?: MedicalUserRole,
  ): Promise<MedicalAnswer> {
    const hasImage = typeof imageBase64 === 'string' && imageBase64.trim().length > 0;

    const classification = roleOverride
      ? {
          role: roleOverride,
          confidence: 1,
          signals: {
            technicalScore: roleOverride === 'DOCTOR' ? 1 : 0,
            colloquialScore: roleOverride === 'PATIENT' ? 1 : 0,
            structureScore: 0,
          },
        }
      : this.classificationService.classifyMessage(query);

    if (classification.confidence < 0.7) {
      return {
        answer:
          'Para orientarte mejor, necesito aclarar el contexto. ¿Eres paciente/familiar o profesional de salud? También indica edad, síntomas principales y tiempo de evolución.',
        citations: [],
        role: classification.role,
        confidence: classification.confidence,
        clarificationRequired: true,
      };
    }

    const imaging = hasImage
      ? await this.medicalImagingService.analyzeImage({
          imageBase64: imageBase64!,
          mimeType: imageMimeType,
          patientAge,
          modalityHint,
        })
      : undefined;

    const retrieval = await this.knowledgeRetriever.retrieve(query, topK, country);

    // Rule: never answer without trusted sources.
    if (retrieval.citations.length === 0) {
      return {
        answer:
          'No puedo responder con base científica porque no hay fuentes confiables recuperadas para esta consulta. Reformula la pregunta o intenta nuevamente más tarde.',
        citations: [],
        role: classification.role,
        confidence: classification.confidence,
        ...(imaging ? { imaging } : {}),
      };
    }

    const roleInstruction =
      classification.role === 'PATIENT'
        ? [
            'Contexto de usuario: PACIENTE.',
            'NO des diagnóstico definitivo.',
            'Dar orientación general, signos de alarma y recomendar consulta médica presencial/profesional.',
            'Usar lenguaje claro y no técnico.',
          ].join('\n')
        : [
            'Contexto de usuario: MÉDICO/PROFESIONAL.',
            'Usar lenguaje clínico técnico y estructurado.',
            'Incluir criterios de evaluación, alternativas diagnósticas y evidencia priorizando guías clínicas.',
          ].join('\n');

    const prompt = [
      'Eres un asistente médico basado en evidencia. Responde solo con el contexto provisto.',
      'Prioriza guías clínicas oficiales por encima de artículos individuales.',
      'Si la evidencia es insuficiente, dilo explícitamente.',
      'Si hay análisis de imagen, úsalo como señal de asistencia complementaria, nunca como diagnóstico definitivo autónomo.',
      roleInstruction,
      'Devuelve JSON con shape exacto: {"answer":"...","citations":[{"source":"...","url":"...","title":"...","date":"..."}]}',
      '',
      `Pregunta: ${query}`,
      imaging
        ? `Resultado imagen (ASISTENCIA): findings=${imaging.findings}; probability=${imaging.probability}; notes=${imaging.notes}`
        : '',
      '',
      'Contexto recuperado:',
      retrieval.context,
    ].join('\n');

    try {
      const raw = await this.groqProvider.run(prompt);
      const parsed = this.extractMedicalJson(raw);
      const safeAnswer =
        classification.role === 'PATIENT'
          ? this.enforcePatientSafety(parsed.answer)
          : parsed.answer;
      return {
        answer: safeAnswer || 'No hay suficiente evidencia para responder con precisión.',
        citations: retrieval.citations,
        role: classification.role,
        confidence: classification.confidence,
        ...(imaging ? { imaging } : {}),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[AI:RAG] fallback deterministic answer: ${message.slice(0, 120)}`);

      const best = retrieval.docs.slice(0, Math.min(3, retrieval.docs.length));
      const answer = best
        .map((d, i) => `${i + 1}. ${d.title} (${d.source}, ${d.date})`)
        .join(' ');

      const fallbackAnswer =
        classification.role === 'PATIENT'
          ? this.enforcePatientSafety(
              `Síntesis basada en evidencia recuperada: ${answer}`,
            )
          : `Síntesis basada en evidencia recuperada: ${answer}`;

      return {
        answer: fallbackAnswer,
        citations: retrieval.citations,
        role: classification.role,
        confidence: classification.confidence,
        ...(imaging ? { imaging } : {}),
      };
    }
  }

  private extractMedicalJson(raw: string): { answer: string } {
    try {
      return JSON.parse(raw) as { answer: string };
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]) as { answer: string };
        } catch {
          return { answer: raw.trim() };
        }
      }
      return { answer: raw.trim() };
    }
  }

  private enforcePatientSafety(answer: string): string {
    const forbidden = [
      'diagnóstico definitivo',
      'definitive diagnosis',
      'usted tiene',
      'you have',
    ];

    const lowered = answer.toLowerCase();
    const containsUnsafe = forbidden.some((x) => lowered.includes(x));

    const safeSuffix =
      ' Esta información es orientativa y no reemplaza una consulta médica. Si hay empeoramiento o signos de alarma, busca atención médica inmediata.';

    if (containsUnsafe) {
      return `Orientación general basada en evidencia disponible.${safeSuffix}`;
    }

    return `${answer}${safeSuffix}`;
  }
}
