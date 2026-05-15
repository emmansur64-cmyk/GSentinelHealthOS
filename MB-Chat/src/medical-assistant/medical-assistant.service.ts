import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AiService } from '../ai/ai.service';
import { MedicalUserRole } from '../ai/classification.service';
import { BrainService } from '../brain/brain.service';
import { IncidentPayload } from '../common/types/brain.types';
import {
  ClinicalActorRole,
  ClinicalAssistantMode,
  evaluateClinicalPolicies,
} from './clinical-policy';
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
    const mode = this.resolveMode(input.mode);
    const explicitRole = this.mapExplicitRole(input.role);

    const modality: 'text' | 'image' | 'multimodal' = hasText && hasImage
      ? 'multimodal'
      : hasImage
        ? 'image'
        : 'text';

    const roleHint = this.normalizeUserTypeHint(input.userTypeHint);
    const roleClassification = explicitRole
      ? { role: this.toMedicalUserRole(explicitRole), confidence: 1 }
      : roleHint
      ? { role: roleHint, confidence: 1 }
      : this.aiService.classifyMedicalRole(query || 'consulta medica por chat clinico');
    const actorRole: ClinicalActorRole = explicitRole ?? this.toClinicalActorRole(roleClassification.role);

    this.logger.log(this.serializeLog({
      event: 'medical_chat.request',
      requestId,
      role: actorRole,
      mode,
      modality,
    }));

    const prePolicyResult = evaluateClinicalPolicies({
      requestId,
      stage: 'pre',
      query,
      role: actorRole,
      mode,
      channel: input.channel,
      modality,
    });

    if (prePolicyResult.decision === 'short_circuit' && prePolicyResult.responseText) {
      this.logger.warn(this.serializeLog({
        event: 'medical_chat.policy_short_circuit',
        requestId,
        role: actorRole,
        mode,
        severity: prePolicyResult.severity,
        policies: prePolicyResult.triggeredPolicies,
        latencyMs: Date.now() - startedAt,
      }));

      return this.buildPolicyResponse(
        input.channel,
        this.toMedicalUserRole(actorRole),
        roleClassification.confidence,
        modality,
        prePolicyResult.responseText,
        prePolicyResult.warnings,
      );
    }

    const effectiveQuery = hasText
      ? query
      : `Interpretar hallazgos de imagen medica (${input.modalityHint ?? 'sin modalidad especificada'}) y contexto clinico.`;

    try {
      const aiRole = this.toMedicalUserRole(actorRole);
      const medical = await this.aiService.answerMedicalQuestion(
        effectiveQuery,
        input.country ?? 'US',
        input.topK ?? 6,
        input.imageBase64,
        input.imageMimeType,
        input.patientAge,
        input.modalityHint,
        aiRole,
      );

      const refinedAnswer = await this.aiService.refineMedicalText(medical.answer);
      let finalAnswer = refinedAnswer;

      if (prePolicyResult.flags.applyPatientFacingBoundaries) {
        const postPolicyResult = evaluateClinicalPolicies({
          requestId,
          stage: 'post',
          query,
          role: actorRole,
          mode,
          channel: input.channel,
          modality,
          responseText: refinedAnswer,
        });

        if (postPolicyResult.transformedText) {
          finalAnswer = postPolicyResult.transformedText;
        }
      }

      let metabrain: MedicalAssistantResponse['metabrain'] | undefined;

      // For text modality we attach ML+rules decision trace in dry-run mode.
      if (hasText && actorRole === 'PATIENT' && !prePolicyResult.flags.skipPatientTriage) {
        const incident: IncidentPayload = {
          id: `clinical-chat-${Date.now()}-${randomUUID().slice(0, 8)}`,
          source: 'clinical-chat-medical-assistant',
          message: query,
          timestamp: new Date().toISOString(),
          metadata: {
            dryRun: true,
            channel: input.channel ?? 'clinical_chat',
            role: aiRole,
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

      if (actorRole === 'PATIENT') {
        warnings.push('Orientacion informativa: no sustituye consulta medica presencial.');
        warnings.push('Ante signos de alarma o empeoramiento, acudir a urgencias.');
      } else {
        warnings.push('Usar como apoyo clinico; validar con contexto del paciente y guias locales.');
      }

      if (prePolicyResult.warnings.length > 0) {
        warnings.push(...prePolicyResult.warnings);
      }

      if (medical.citations.length === 0) {
        warnings.push('No se recuperaron fuentes confiables para esta consulta.');
      }

      const response: MedicalAssistantResponse = {
        channel: input.channel ?? 'clinical_chat',
        role: aiRole,
        roleConfidence: roleClassification.confidence,
        modality,
        response: {
          text: finalAnswer,
          citations: medical.citations,
        },
        guidance: {
          languageStyle: actorRole === 'PATIENT' ? 'simple' : 'technical',
          warnings,
        },
        ...(medical.imaging ? { imaging: medical.imaging } : {}),
        ...(metabrain ? { metabrain } : {}),
      };

      this.logger.log(this.serializeLog({
        event: 'medical_chat.response',
        requestId,
        role: actorRole,
        mode,
        providerStatus: 'ok',
        severity: prePolicyResult.severity,
        policies: prePolicyResult.triggeredPolicies,
        latencyMs: Date.now() - startedAt,
      }));

      return response;
    } catch (error) {
      const safeError = this.sanitizeErrorClass(error);

      const errorPolicyResult = evaluateClinicalPolicies({
        requestId,
        stage: 'error',
        query,
        role: actorRole,
        mode,
        channel: input.channel,
        modality,
        providerErrorClass: safeError,
      });

      this.logger.error(this.serializeLog({
        event: 'medical_chat.error',
        requestId,
        role: actorRole,
        mode,
        providerStatus: 'fallback',
        latencyMs: Date.now() - startedAt,
        severity: errorPolicyResult.severity,
        policies: errorPolicyResult.triggeredPolicies,
        errorClass: safeError,
      }));

      return this.buildPolicyResponse(
        input.channel,
        this.toMedicalUserRole(actorRole),
        roleClassification.confidence,
        modality,
        errorPolicyResult.responseText
          ?? 'No puedo generar una respuesta clinica segura en este momento. Recomiendo evaluacion profesional presencial para una orientacion adecuada.',
        errorPolicyResult.warnings.length > 0
          ? errorPolicyResult.warnings
          : [
              'Se activo respuesta segura por indisponibilidad temporal del proveedor.',
              'Si hay signos de alarma, acudir a urgencias.',
            ],
      );
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

  private mapExplicitRole(role?: MedicalAssistantRole): ClinicalActorRole | undefined {
    if (!role) {
      return undefined;
    }

    if (role === MedicalAssistantRole.PATIENT) {
      return 'PATIENT';
    }

    if (role === MedicalAssistantRole.DOCTOR) {
      return 'DOCTOR';
    }

    if (role === MedicalAssistantRole.ADMIN) {
      return 'ADMIN';
    }

    return undefined;
  }

  private toClinicalActorRole(role: MedicalUserRole): ClinicalActorRole {
    return role === 'PATIENT' ? 'PATIENT' : 'DOCTOR';
  }

  private toMedicalUserRole(role: ClinicalActorRole): MedicalUserRole {
    return role === 'PATIENT' ? 'PATIENT' : 'DOCTOR';
  }

  private resolveMode(mode?: MedicalAssistantMode): ClinicalAssistantMode {
    if (mode === MedicalAssistantMode.DOCTOR_PROFESSIONAL) {
      return 'doctor_professional';
    }

    return 'clinical_support';
  }

  private buildPolicyResponse(
    channel: string | undefined,
    role: MedicalUserRole,
    roleConfidence: number,
    modality: 'text' | 'image' | 'multimodal',
    responseText: string,
    warnings: string[],
  ): MedicalAssistantResponse {
    return {
      channel: channel ?? 'clinical_chat',
      role,
      roleConfidence,
      modality,
      response: {
        text: responseText,
        citations: [],
      },
      guidance: {
        languageStyle: role === 'PATIENT' ? 'simple' : 'technical',
        warnings,
      },
    };
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
