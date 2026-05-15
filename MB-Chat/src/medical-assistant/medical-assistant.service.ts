import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AiService } from '../ai/ai.service';
import { MedicalUserRole } from '../ai/classification.service';
import { BrainService } from '../brain/brain.service';
import { IncidentPayload } from '../common/types/brain.types';
import {
  MedicalAssistantMode,
  MedicalAssistantRequest,
  MedicalAssistantResponse,
  MedicalAssistantRole,
} from './medical-assistant.types';

@Injectable()
export class MedicalAssistantService {
  private readonly logger = new Logger(MedicalAssistantService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly brainService: BrainService,
  ) {}

  async handleMedicalChatMessage(input: MedicalAssistantRequest): Promise<MedicalAssistantResponse> {
    const startedAt = Date.now();
    const requestId = `medchat-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const query = (input.message ?? input.query ?? '').trim();
    const hasText = query.length > 0;
    const hasImage = typeof input.imageBase64 === 'string' && input.imageBase64.trim().length > 0;
    const explicitRole = this.mapExplicitRole(input.role);

    const modality: 'text' | 'image' | 'multimodal' = hasText && hasImage
      ? 'multimodal'
      : hasImage
        ? 'image'
        : 'text';

    const roleHint = this.normalizeUserTypeHint(input.userTypeHint);
    const roleClassification = explicitRole
      ? { role: explicitRole, confidence: 1 }
      : roleHint
      ? { role: roleHint, confidence: 1 }
      : this.aiService.classifyMedicalRole(query || 'consulta medica por chat clinico');

    this.logger.log(this.serializeLog({
      event: 'medical_chat.request',
      requestId,
      role: input.role ?? roleClassification.role,
      mode: input.mode ?? MedicalAssistantMode.CLINICAL_SUPPORT,
      modality,
    }));

    const emergencyResponse = this.buildEmergencyResponseIfNeeded(query, input.channel, roleClassification.role);
    if (emergencyResponse) {
      this.logger.warn(this.serializeLog({
        event: 'medical_chat.emergency_short_circuit',
        requestId,
        role: roleClassification.role,
        mode: input.mode ?? MedicalAssistantMode.CLINICAL_SUPPORT,
        latencyMs: Date.now() - startedAt,
      }));
      return emergencyResponse;
    }

    const missingClinicalDataResponse = this.buildMissingClinicalDataResponse(query, input.channel, roleClassification.role);
    if (missingClinicalDataResponse) {
      this.logger.log(this.serializeLog({
        event: 'medical_chat.missing_clinical_data',
        requestId,
        role: roleClassification.role,
        mode: input.mode ?? MedicalAssistantMode.CLINICAL_SUPPORT,
        latencyMs: Date.now() - startedAt,
      }));
      return missingClinicalDataResponse;
    }

    const definitiveDiagnosisResponse = this.buildDefinitiveDiagnosisLimitResponse(query, input.channel, roleClassification.role);
    if (definitiveDiagnosisResponse) {
      this.logger.log(this.serializeLog({
        event: 'medical_chat.definitive_diagnosis_limited',
        requestId,
        role: roleClassification.role,
        mode: input.mode ?? MedicalAssistantMode.CLINICAL_SUPPORT,
        latencyMs: Date.now() - startedAt,
      }));
      return definitiveDiagnosisResponse;
    }

    const effectiveQuery = hasText
      ? query
      : `Interpretar hallazgos de imagen medica (${input.modalityHint ?? 'sin modalidad especificada'}) y contexto clinico.`;

    try {
      const medical = await this.aiService.answerMedicalQuestion(
        effectiveQuery,
        input.country ?? 'US',
        input.topK ?? 6,
        input.imageBase64,
        input.imageMimeType,
        input.patientAge,
        input.modalityHint,
        roleClassification.role,
      );

      let refinedAnswer = await this.aiService.refineMedicalText(medical.answer);

      if (roleClassification.role !== 'DOCTOR') {
        refinedAnswer = this.applyPatientFacingSafety(refinedAnswer);
      }

      if (input.mode === MedicalAssistantMode.CLINICAL_SUPPORT && roleClassification.role !== 'DOCTOR') {
        refinedAnswer = this.applyPatientFacingSafety(refinedAnswer);
      }

      let metabrain: MedicalAssistantResponse['metabrain'] | undefined;

      // For text modality we attach ML+rules decision trace in dry-run mode.
      if (hasText && roleClassification.role !== 'DOCTOR') {
        const incident: IncidentPayload = {
          id: `clinical-chat-${Date.now()}-${randomUUID().slice(0, 8)}`,
          source: 'clinical-chat-medical-assistant',
          message: query,
          timestamp: new Date().toISOString(),
          metadata: {
            dryRun: true,
            channel: input.channel ?? 'clinical_chat',
            role: roleClassification.role,
            modality,
            domain: 'medical_assistant',
          },
        };

        const decision = await this.brainService.processIncident(incident);
        metabrain = {
          status: decision.status,
          action: decision.action,
          reason: decision.reason,
          dryRun: true,
        };
      }

      const warnings: string[] = [];

      if (roleClassification.role === 'PATIENT') {
        warnings.push('Orientacion informativa: no sustituye consulta medica presencial.');
        warnings.push('Ante signos de alarma o empeoramiento, acudir a urgencias.');
      } else {
        warnings.push('Usar como apoyo clinico; validar con contexto del paciente y guias locales.');
      }

      if (medical.citations.length === 0) {
        warnings.push('No se recuperaron fuentes confiables para esta consulta.');
      }

      const response: MedicalAssistantResponse = {
        channel: input.channel ?? 'clinical_chat',
        role: roleClassification.role,
        roleConfidence: roleClassification.confidence,
        modality,
        response: {
          text: refinedAnswer,
          citations: medical.citations,
        },
        guidance: {
          languageStyle: roleClassification.role === 'PATIENT' ? 'simple' : 'technical',
          warnings,
        },
        ...(medical.imaging ? { imaging: medical.imaging } : {}),
        ...(metabrain ? { metabrain } : {}),
      };

      this.logger.log(this.serializeLog({
        event: 'medical_chat.response',
        requestId,
        role: roleClassification.role,
        mode: input.mode ?? MedicalAssistantMode.CLINICAL_SUPPORT,
        providerStatus: 'ok',
        latencyMs: Date.now() - startedAt,
      }));

      return response;
    } catch (error) {
      const safeError = this.sanitizeErrorClass(error);
      this.logger.error(this.serializeLog({
        event: 'medical_chat.error',
        requestId,
        role: input.role ?? roleClassification.role,
        mode: input.mode ?? MedicalAssistantMode.CLINICAL_SUPPORT,
        providerStatus: 'fallback',
        latencyMs: Date.now() - startedAt,
        errorClass: safeError,
      }));

      return {
        channel: input.channel ?? 'clinical_chat',
        role: roleClassification.role,
        roleConfidence: roleClassification.confidence,
        modality,
        response: {
          text: 'No puedo generar una respuesta clinica segura en este momento. Recomiendo evaluacion profesional presencial para una orientacion adecuada.',
          citations: [],
        },
        guidance: {
          languageStyle: roleClassification.role === 'PATIENT' ? 'simple' : 'technical',
          warnings: [
            'Se activo respuesta segura por indisponibilidad temporal del proveedor.',
            'Si hay signos de alarma, acudir a urgencias.',
          ],
        },
      };
    }
  }

  private normalizeUserTypeHint(hint?: string): MedicalUserRole | undefined {
    if (!hint) return undefined;
    const text = hint.trim().toLowerCase();

    if (['paciente', 'patient', 'familiar'].includes(text)) {
      return 'PATIENT';
    }

    if (['medico', 'médico', 'doctor', 'profesional', 'clinico', 'clínico'].includes(text)) {
      return 'DOCTOR';
    }

    return undefined;
  }

  private mapExplicitRole(role?: MedicalAssistantRole): MedicalUserRole | undefined {
    if (!role) {
      return undefined;
    }

    if (role === MedicalAssistantRole.PATIENT) {
      return 'PATIENT';
    }

    if (role === MedicalAssistantRole.DOCTOR || role === MedicalAssistantRole.ADMIN) {
      return 'DOCTOR';
    }

    return undefined;
  }

  private buildEmergencyResponseIfNeeded(
    query: string,
    channel: string | undefined,
    role: MedicalUserRole,
  ): MedicalAssistantResponse | undefined {
    const lowered = query.toLowerCase();
    const emergencySignals = [
      'dolor de pecho',
      'no puedo respirar',
      'convulsion',
      'convulsión',
      'desmayo',
      'sangrado abundante',
      'suicid',
      'stroke',
      'acv',
      'infarto',
      'anaphyl',
    ];

    if (!emergencySignals.some((signal) => lowered.includes(signal))) {
      return undefined;
    }

    return {
      channel: channel ?? 'clinical_chat',
      role,
      roleConfidence: 1,
      modality: 'text',
      response: {
        text: 'Posible emergencia detectada. Busca atencion medica de urgencia de inmediato o llama al servicio de emergencias local ahora.',
        citations: [],
      },
      guidance: {
        languageStyle: role === 'DOCTOR' ? 'technical' : 'simple',
        warnings: [
          'Respuesta abreviada por seguridad clinica.',
          'No continuar autoevaluacion en chat ante posible emergencia.',
        ],
      },
    };
  }

  private buildMissingClinicalDataResponse(
    query: string,
    channel: string | undefined,
    role: MedicalUserRole,
  ): MedicalAssistantResponse | undefined {
    if (role === 'DOCTOR') {
      return undefined;
    }

    const lowered = query.toLowerCase();
    const isShort = lowered.length < 10;
    const containsSymptoms = /(dolor|fiebre|tos|mareo|nausea|náusea|vomito|vómito|lesion|lesión)/.test(lowered);
    const containsDuration = /(hora|horas|dia|días|dias|semana|semanas)/.test(lowered);

    if (!isShort && containsSymptoms && containsDuration) {
      return undefined;
    }

    return {
      channel: channel ?? 'clinical_chat',
      role,
      roleConfidence: 1,
      modality: 'text',
      response: {
        text: 'Para orientarte sin asumir un diagnostico definitivo, necesito datos minimos: edad, sintomas principales, tiempo de evolucion y signos de alarma presentes.',
        citations: [],
      },
      guidance: {
        languageStyle: 'simple',
        warnings: ['Informacion insuficiente para orientar con seguridad clinica.'],
      },
    };
  }

  private buildDefinitiveDiagnosisLimitResponse(
    query: string,
    channel: string | undefined,
    role: MedicalUserRole,
  ): MedicalAssistantResponse | undefined {
    if (role === 'DOCTOR') {
      return undefined;
    }

    const lowered = query.toLowerCase();
    if (!/(diagnostico definitivo|diagnóstico definitivo|dime que tengo|confirmame el diagnostico|confírmame el diagnóstico)/.test(lowered)) {
      return undefined;
    }

    return {
      channel: channel ?? 'clinical_chat',
      role,
      roleConfidence: 1,
      modality: 'text',
      response: {
        text: 'No puedo confirmar un diagnostico definitivo por chat. Puedo darte orientacion general y los proximos pasos, pero necesitas evaluacion profesional para confirmar diagnostico.',
        citations: [],
      },
      guidance: {
        languageStyle: 'simple',
        warnings: ['Diagnostico definitivo limitado por seguridad clinica.'],
      },
    };
  }

  private applyPatientFacingSafety(text: string): string {
    const lowered = text.toLowerCase();
    if (/(diagnóstico definitivo|diagnostico definitivo|usted tiene|you have)/.test(lowered)) {
      return 'Orientacion general basada en informacion disponible. No sustituye una evaluacion medica presencial para confirmar diagnostico.';
    }

    return text;
  }

  private sanitizeErrorClass(error: unknown): string {
    if (!(error instanceof Error)) {
      return 'UnknownError';
    }

    const safeClass = error.name.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 80);
    return safeClass || 'Error';
  }

  private serializeLog(payload: Record<string, unknown>): string {
    return JSON.stringify(payload);
  }
}
