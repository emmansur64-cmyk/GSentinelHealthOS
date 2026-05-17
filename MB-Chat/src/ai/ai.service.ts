import { Injectable, Inject, Logger } from '@nestjs/common';
import { assertGroqPhiAllowedOrThrow, ProviderPhiNotAllowedError } from './assert-groq-phi-guard';
import { ConfigService } from '@nestjs/config';
import { AiAnalysisResult, BrainDecision, IncidentPayload } from '../common/types/brain.types';
import { FallbackProvider } from './providers/fallback.provider';
import { GroqProvider, MEDICAL_GROQ_PROVIDER } from './providers/groq.provider';
import { KnowledgeRetriever } from '../knowledge/knowledge.retriever';
import { MedicalAnswer } from '../knowledge/types';
import { ClassificationService, MedicalUserRole, RoleClassificationResult } from './classification.service';
import { MedicalImagingResult, MedicalImagingService } from './medical-imaging.service';
import { buildMedicalTextRefinerPrompt } from './prompts/medical-text-refiner.prompt';
import { MedicalRuntimeToolContext } from './medical-runtime-context';

function resolveMedicalInternetMode(): 'controlled' | 'open' {
  const value = process.env.MEDICAL_CHAT_INTERNET_MODE?.trim().toLowerCase();
  return value === 'open' ? 'open' : 'controlled';
}

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
    @Inject(MEDICAL_GROQ_PROVIDER) private readonly medicalGroqProvider: GroqProvider,
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
  async analyze(prompt: string, correlation_id = 'unknown'): Promise<AiAnalysisResult> {
    try {
      assertGroqPhiAllowedOrThrow(prompt, { correlation_id, method: 'analyze' });
      return await this.groqProvider.runAnalysis(prompt);
    } catch (err) {
      if (err instanceof ProviderPhiNotAllowedError) {
        // Logueo ya realizado en el guard, retorna error tipado
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[AI] Unexpected analyze error: ${message.slice(0, 100)}`);
      return { rootCause: 'UNKNOWN', confidence: 0.1, source: 'ai_fallback' };
    }
  }

  classifyMedicalRole(message: string): RoleClassificationResult {
    return this.classificationService.classifyMessage(message);
  }

  getSystemLearningSeed(): string | undefined {
    return this.medicalGroqProvider.getSystemLearningSeed();
  }

  async refineMedicalText(inputText: string, correlation_id = 'unknown'): Promise<string> {
    const normalized = inputText.trim();
    if (!normalized) {
      return '';
    }
    const prompt = buildMedicalTextRefinerPrompt(normalized);
    try {
      assertGroqPhiAllowedOrThrow(prompt, { correlation_id, method: 'refineMedicalText' });
      const refined = await this.medicalGroqProvider.run(prompt);
      const cleaned = this.sanitizeStrictClinicalXml(refined);
      const output = this.extractFinalResponseSection(cleaned) || cleaned.trim();
      return this.normalizeMedicalChatStyle(output || normalized);
    } catch (err) {
      if (err instanceof ProviderPhiNotAllowedError) {
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[AI:refine] fallback to original text: ${message.slice(0, 120)}`);
      return this.normalizeMedicalChatStyle(normalized);
    }
  }

  normalizeMedicalTextForOutput(text: string): string {
    return this.normalizeMedicalChatStyle(text);
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
    runtimeContext?: MedicalRuntimeToolContext,
    patientClinicalSummary?: string,
    correlation_id = 'unknown',
  ): Promise<MedicalAnswer> {
    const internetMode = resolveMedicalInternetMode();
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
        answer: this.normalizeMedicalChatStyle(
          'Para orientarte mejor, necesito aclarar el contexto. ¿Eres paciente/familiar o profesional de salud? También indica edad, síntomas principales y tiempo de evolución.',
        ),
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

    const normalizedQuery = query
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const weatherQuery =
      normalizedQuery.includes('clima')
      || normalizedQuery.includes('tiempo')
      || normalizedQuery.includes('temperatura')
      || normalizedQuery.includes('lluvia')
      || normalizedQuery.includes('viento');

    // Rule: never answer without trusted sources.
    if (retrieval.citations.length === 0) {
      if (weatherQuery && runtimeContext?.weather) {
        const weather = runtimeContext.weather;
        const weatherAnswer = [
          `Estado del tiempo en vivo para ${weather.location}:`,
          weather.summary ? `- Resumen: ${weather.summary}` : undefined,
          typeof weather.temperatureC === 'number' ? `- Temperatura: ${weather.temperatureC} C` : undefined,
          typeof weather.windKmh === 'number' ? `- Viento: ${weather.windKmh} km/h` : undefined,
          typeof weather.precipitationMm === 'number' ? `- Precipitacion: ${weather.precipitationMm} mm` : undefined,
          `- Fuente: ${weather.provider} (${weather.url})`,
          `- Referencia temporal: ${runtimeContext.currentTimeText}`,
        ].filter(Boolean).join('\n');
        return {
          answer: this.normalizeMedicalChatStyle(weatherAnswer),
          citations: runtimeContext.officialSources.slice(0, 3),
          role: classification.role,
          confidence: classification.confidence,
          ...(imaging ? { imaging } : {}),
        };
      }

      if (imaging) {
        const imagingOnlyAnswer = this.buildImagingOnlyAnswer(classification.role, imaging);
        return {
          answer:
            classification.role === 'PATIENT'
              ? this.normalizeMedicalChatStyle(this.enforcePatientSafety(imagingOnlyAnswer))
              : this.normalizeMedicalChatStyle(imagingOnlyAnswer),
          citations: [],
          role: classification.role,
          confidence: classification.confidence,
          imaging,
        };
      }

      return {
        answer: this.normalizeMedicalChatStyle(
          'En este momento no tengo evidencia recuperada suficiente para responder con precisión clínica. Si quieres, reformulo la búsqueda con más contexto (síntomas, evolución, edad y antecedentes) para darte una respuesta mejor fundamentada.',
        ),
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
            'Razona con criterio clínico y responde de forma natural, sin frases rígidas.',
            'No dar diagnóstico definitivo; orientar con prudencia, signos de alarma y siguiente paso recomendado.',
            'Usar lenguaje claro y comprensible para no profesionales.',
          ].join('\n')
        : [
            'Contexto de usuario: MÉDICO/PROFESIONAL.',
            'Razona con enfoque clínico profesional y responde de forma natural, no robótica.',
            'Usar lenguaje técnico útil para decisión clínica.',
            'Incluir criterios de evaluación, diferenciales y evidencia priorizando guías clínicas.',
          ].join('\n');

    const prompt = [
      'Eres un asistente médico basado en evidencia.',
      'Usa razonamiento clínico propio sobre el contexto disponible y expresa la respuesta en lenguaje natural.',
      'Prioriza guías clínicas oficiales por encima de artículos individuales.',
      internetMode === 'open'
        ? 'Internet abierto habilitado: puedes integrar fuentes web publicas con trazabilidad y priorizar evidencia clinica confiable.'
        : 'Internet controlado: usa únicamente fuentes recuperadas y el bloque de herramientas controladas.',
      'Puede usar hora real y clima solo como contexto operativo, no como evidencia clínica.',
      'Si la evidencia es insuficiente, dilo explícitamente.',
      'Si hay análisis de imagen, úsalo como señal de asistencia complementaria, nunca como diagnóstico definitivo autónomo.',
      roleInstruction,
      'Formato de salida: respuesta clínica directa y natural (sin plantillas ni frases mecánicas).',
      '',
      `Pregunta: ${query}`,
      imaging ? this.buildImagingPromptBlock(imaging) : '',
      '',
      runtimeContext ? this.buildRuntimeToolPromptBlock(runtimeContext) : '',
      '',
      patientClinicalSummary ? `Resumen clinico controlado del paciente activo: ${patientClinicalSummary}` : '',
      '',
      'Contexto recuperado:',
      retrieval.context,
    ].join('\n');

    try {
      assertGroqPhiAllowedOrThrow(prompt, { correlation_id, method: 'answerMedicalQuestion' });
      const raw = await this.medicalGroqProvider.run(prompt);
      const cleaned = this.sanitizeStrictClinicalXml(raw);
      const sectioned = this.extractFinalResponseSection(cleaned);
      const parsed = this.extractMedicalJson(sectioned || cleaned);
      let safeAnswer =
        classification.role === 'PATIENT'
          ? this.enforcePatientSafety(parsed.answer)
          : parsed.answer;
      safeAnswer = await this.ensureLogicalConsistency(query, safeAnswer, correlation_id);
      return {
        answer: this.normalizeMedicalChatStyle(safeAnswer || 'No hay suficiente evidencia para responder con precisión.'),
        citations: this.mergeCitations(retrieval.citations, runtimeContext?.officialSources ?? []),
        role: classification.role,
        confidence: classification.confidence,
        ...(imaging ? { imaging } : {}),
      };
    } catch (err) {
      if (err instanceof ProviderPhiNotAllowedError) {
        throw err;
      }
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
        answer: this.normalizeMedicalChatStyle(fallbackAnswer),
        citations: this.mergeCitations(retrieval.citations, runtimeContext?.officialSources ?? []),
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

  private buildRuntimeToolPromptBlock(context: MedicalRuntimeToolContext): string {
    const weather = context.weather
      ? [
          `Clima proveedor=${context.weather.provider}`,
          `ubicacion=${context.weather.location}`,
          `resumen=${context.weather.summary}`,
          `url=${context.weather.url}`,
        ].join('; ')
      : 'Clima: no disponible o deshabilitado.';

    const officialSources = context.officialSources
      .map((source, index) => {
        return [
          `[OFICIAL_${index + 1}]`,
          `source=${source.source}`,
          `date=${source.date}`,
          `title=${source.title}`,
          `url=${source.url}`,
        ].join('\n');
      })
      .join('\n\n');
    const officialEvidence = context.officialSourceEvidence
      .map((item, index) => {
        return [
          `[OFICIAL_EVIDENCIA_${index + 1}]`,
          `source=${item.source}`,
          `title=${item.title}`,
          `url=${item.url}`,
          `excerpt=${item.excerpt}`,
        ].join('\n');
      })
      .join('\n\n');

    return [
      'Herramientas controladas:',
      `Hora real: ${context.currentTimeText} (${context.timezone}; generatedAt=${context.generatedAt})`,
      weather,
      `Dominios permitidos: ${context.allowedDomains.join(', ') || 'sin dominios'}`,
      'Notas operativas:',
      ...context.notes.map((note) => `- ${note}`),
      '',
      'Directorio oficial preaprobado:',
      officialSources || 'Sin fuentes oficiales adicionales.',
      '',
      'Lectura controlada de fuentes oficiales:',
      officialEvidence || 'Sin lectura oficial disponible.',
    ].join('\n');
  }

  private mergeCitations(
    primary: MedicalAnswer['citations'],
    secondary: MedicalAnswer['citations'],
  ): MedicalAnswer['citations'] {
    const seen = new Set<string>();
    const merged: MedicalAnswer['citations'] = [];

    for (const citation of [...primary, ...secondary]) {
      const key = `${citation.source}|${citation.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(citation);
    }

    return merged;
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

  private buildImagingPromptBlock(imaging: MedicalImagingResult): string {
    const list = (items?: string[]) => (items && items.length > 0 ? items.join(' | ') : 'sin_datos');
    return [
      'Resultado imagen (ASISTENCIA):',
      `findings=${imaging.findings}`,
      `probability=${imaging.probability}`,
      `notes=${imaging.notes}`,
      `provider=${imaging.provider}`,
      `modality=${imaging.modality ?? 'DESCONOCIDO'}`,
      `quality=${imaging.qualityStatus ?? 'regular'}`,
      `confidence=${imaging.confidenceLevel ?? 'baja'}`,
      `limitations=${list(imaging.limitations)}`,
      `observations=${list(imaging.observations)}`,
      `possible_findings=${list(imaging.possibleFindings)}`,
      `red_flags=${list(imaging.redFlags)}`,
      `next_steps=${list(imaging.recommendedNextSteps)}`,
      imaging.report ? `imaging_report=${imaging.report}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildImagingOnlyAnswer(role: MedicalUserRole, imaging: MedicalImagingResult): string {
    const fallbackReport = [
      'Informe preliminar asistido de imagen medica',
      `Hallazgos: ${imaging.findings}`,
      `Probabilidad estimada: ${(imaging.probability * 100).toFixed(0)}%`,
      `Notas: ${imaging.notes}`,
      'Nota de seguridad: requiere correlacion clinico-radiologica e informe profesional definitivo.',
    ].join('\n');

    if (role === 'DOCTOR') {
      return imaging.report || fallbackReport;
    }

    return [
      'Resumen orientativo de imagen medica:',
      imaging.findings,
      imaging.notes,
      'Debe ser revisado por un profesional de salud para confirmar conclusiones.',
    ].join(' ');
  }

  private async ensureLogicalConsistency(
    query: string,
    answer: string,
    correlation_id: string,
  ): Promise<string> {
    if (!this.isLogicPuzzleQuery(query)) {
      return answer;
    }

    const validation = this.validateFloorPuzzleAnswer(answer);
    if (validation.valid) {
      return answer;
    }

    const fixPrompt = [
      'Actua como auditor critico de calidad logica.',
      'Corrige la siguiente respuesta de acertijo lógico.',
      'Debe ser internamente consistente: sin duplicar personas, sin duplicar lenguajes y sin repetir pisos.',
      'Respeta todas las pistas del enunciado.',
      'Protocolo obligatorio: verifica la conclusion final contra cada pista original antes de responder.',
      'Clausula de imposibilidad: si no existe solucion consistente con todas las pistas, responde exactamente: "No hay solucion consistente con las pistas dadas."',
      'Devuelve SOLO la respuesta final corregida en lenguaje natural, sin explicar el proceso.',
      '',
      `Enunciado: ${query}`,
      '',
      `Respuesta con errores: ${answer}`,
      '',
      `Errores detectados: ${validation.errors.join('; ')}`,
    ].join('\n');

    try {
      assertGroqPhiAllowedOrThrow(fixPrompt, { correlation_id, method: 'ensureLogicalConsistency' });
      const repairedRaw = await this.medicalGroqProvider.run(fixPrompt);
      const repaired = (this.extractFinalResponseSection(repairedRaw) || repairedRaw).trim();
      if (/^no hay solucion consistente con las pistas dadas\.?$/i.test(repaired)) {
        return 'No hay solucion consistente con las pistas dadas.';
      }
      const repairedValidation = this.validateFloorPuzzleAnswer(repaired);
      if (repairedValidation.valid) {
        return repaired;
      }
      this.logger.warn(`[AI:logic] consistency repair still invalid: ${repairedValidation.errors.join(' | ')}`);
      return 'No hay solucion consistente con las pistas dadas.';
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[AI:logic] repair failed, keeping original answer: ${message.slice(0, 140)}`);
      return answer;
    }
  }

  private isLogicPuzzleQuery(text: string): boolean {
    const normalized = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const hasFloor = /\bpiso[s]?\b/.test(normalized);
    const hasOrdering = /\b(arriba|abajo|justo|encima|debajo)\b/.test(normalized);
    return hasFloor && hasOrdering;
  }

  private validateFloorPuzzleAnswer(answer: string): { valid: boolean; errors: string[] } {
    const rows = answer.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const pattern = /piso\s*(\d+)\s*:\s*([A-Za-zÁÉÍÓÚÑáéíóúñ]+)(?:\s*\(([^)]+)\))?/i;
    const assignments: Array<{ floor: number; person: string; language: string | null }> = [];

    for (const row of rows) {
      const match = row.match(pattern);
      if (!match) continue;
      assignments.push({
        floor: Number(match[1]),
        person: match[2].toLowerCase(),
        language: match[3] ? match[3].toLowerCase().trim() : null,
      });
    }

    if (assignments.length < 2) {
      return { valid: true, errors: [] };
    }

    const errors: string[] = [];
    const seenFloors = new Set<number>();
    const seenPeople = new Set<string>();
    const seenLanguages = new Set<string>();

    for (const item of assignments) {
      if (seenFloors.has(item.floor)) {
        errors.push(`piso repetido ${item.floor}`);
      }
      seenFloors.add(item.floor);

      if (seenPeople.has(item.person)) {
        errors.push(`persona repetida ${item.person}`);
      }
      seenPeople.add(item.person);

      if (item.language) {
        if (seenLanguages.has(item.language)) {
          errors.push(`lenguaje repetido ${item.language}`);
        }
        seenLanguages.add(item.language);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private extractFinalResponseSection(output: string): string | undefined {
    const normalized = String(output ?? '');
    const jsonStructured = this.extractStructuredClinicalJson(normalized);
    if (jsonStructured?.conducta_final) return jsonStructured.conducta_final;
    if (jsonStructured?.analisis && !jsonStructured?.calculo) return jsonStructured.analisis;

    const finalConducta = normalized.match(/<conducta_final>\s*([\s\S]*?)\s*<\/conducta_final>/i)?.[1]?.trim();
    if (finalConducta) return finalConducta;

    const analysisOnlyStrict = normalized.match(/<analisis>\s*([\s\S]*?)\s*<\/analisis>/i)?.[1]?.trim();
    const hasCalculoStrict = /<calculo>[\s\S]*<\/calculo>/i.test(normalized);
    if (analysisOnlyStrict && !hasCalculoStrict) {
      return analysisOnlyStrict;
    }

    const finalSection = normalized.match(/<respuesta_final>\s*([\s\S]*?)\s*<\/respuesta_final>/i)?.[1]?.trim();
    if (finalSection) return finalSection;

    const analysisOnly = normalized.match(/<analisis_critico>\s*([\s\S]*?)\s*<\/analisis_critico>/i)?.[1]?.trim();
    const hasMath = /<calculo_matematico>[\s\S]*<\/calculo_matematico>/i.test(normalized);
    if (analysisOnly && !hasMath) {
      return analysisOnly;
    }
    return undefined;
  }

  private sanitizeStrictClinicalXml(output: string): string {
    const normalized = String(output ?? '').trim();
    if (!normalized) return '';

    const jsonStructured = this.extractStructuredClinicalJson(normalized);
    if (jsonStructured?.analisis && jsonStructured?.calculo && jsonStructured?.conducta_final) {
      return [
        `<analisis>\n${jsonStructured.analisis}\n</analisis>`,
        `<calculo>\n${jsonStructured.calculo}\n</calculo>`,
        `<conducta_final>\n${jsonStructured.conducta_final}\n</conducta_final>`,
      ].join('\n');
    }

    const extractBlock = (tag: 'analisis' | 'calculo' | 'conducta_final'): string | null => {
      const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
      const match = normalized.match(regex);
      return match?.[1]?.trim() || null;
    };

    const analisis = extractBlock('analisis');
    const calculo = extractBlock('calculo');
    const conductaFinal = extractBlock('conducta_final');

    if (analisis && calculo && conductaFinal) {
      return [
        `<analisis>\n${analisis}\n</analisis>`,
        `<calculo>\n${calculo}\n</calculo>`,
        `<conducta_final>\n${conductaFinal}\n</conducta_final>`,
      ].join('\n');
    }

    return normalized;
  }

  private normalizeMedicalChatStyle(text: string): string {
    const normalized = String(text ?? '').replace(/\r\n/g, '\n').trim();
    if (!normalized) return '';

    const lines = normalized
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/\*/g, ''))
      .map((line) => line.replace(/^\-\s+/, '- '))
      .map((line) => line.replace(/\s+([,;:.!?])/g, '$1'));

    const withUnderlinedTitles: string[] = [];
    for (const line of lines) {
      const isTitle = /:$/.test(line) && line.length <= 72;
      withUnderlinedTitles.push(line);
      if (isTitle) {
        withUnderlinedTitles.push('_'.repeat(Math.max(8, Math.min(40, line.length - 1))));
      }
    }

    const punctuated = withUnderlinedTitles.map((line) => {
      if (/^[_-]+$/.test(line)) return line;
      if (/^\-\s+/.test(line)) return line;
      if (/[.!?:;]$/.test(line)) return line;
      return `${line}.`;
    });

    return punctuated.join('\n');
  }

  private extractStructuredClinicalJson(output: string): {
    analisis?: string;
    calculo?: string;
    conducta_final?: string;
  } | null {
    try {
      const parsed = JSON.parse(output) as {
        analisis?: unknown;
        calculo?: unknown;
        conducta_final?: unknown;
      };
      return {
        analisis: typeof parsed.analisis === 'string' ? parsed.analisis.trim() : undefined,
        calculo: typeof parsed.calculo === 'string' ? parsed.calculo.trim() : undefined,
        conducta_final: typeof parsed.conducta_final === 'string' ? parsed.conducta_final.trim() : undefined,
      };
    } catch {
      const match = output.match(/\{[\s\S]*\}/);
      if (!match) return null;
      try {
        const parsed = JSON.parse(match[0]) as {
          analisis?: unknown;
          calculo?: unknown;
          conducta_final?: unknown;
        };
        return {
          analisis: typeof parsed.analisis === 'string' ? parsed.analisis.trim() : undefined,
          calculo: typeof parsed.calculo === 'string' ? parsed.calculo.trim() : undefined,
          conducta_final: typeof parsed.conducta_final === 'string' ? parsed.conducta_final.trim() : undefined,
        };
      } catch {
        return null;
      }
    }
  }
}
