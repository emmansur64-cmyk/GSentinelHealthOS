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
import { MedicalChatLearningService } from './learning/medical-chat-learning.service';
import { MedicalRuntimeToolsService } from './tools/medical-runtime-tools.service';
import {
  ActivePatientClinicalHistory,
  DoctorPatientContext,
  InvalidDoctorPatientContextError,
  PatientContextAccessDeniedError,
} from './doctor-patient-context.contract';
import { ProviderPhiNotAllowedError, assertGroqPhiAllowedOrThrow } from '../ai/assert-groq-phi-guard';

@Injectable()
export class MedicalAssistantService {
  private readonly logger = new Logger(MedicalAssistantService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly brainService: BrainService,
    private readonly runtimeToolsService: MedicalRuntimeToolsService,
    private readonly medicalChatLearningService: MedicalChatLearningService,
  ) {}

  async handleMedicalChatMessage(input: MedicalAssistantRequest): Promise<MedicalAssistantResponse> {
    const startedAt = Date.now();
    const requestId = `medchat-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const query = (input.message ?? input.query ?? '').trim();
    const hasText = query.length > 0;
    const hasImage = typeof input.imageBase64 === 'string' && input.imageBase64.trim().length > 0;
    const effectiveSessionId = (
      input.sessionId?.trim()
      || [
        input.doctorPatientContext?.doctor_id?.trim(),
        input.doctorPatientContext?.patient_id?.trim(),
        input.channel?.trim(),
        input.role?.toString(),
      ].filter((value): value is string => Boolean(value && value.length > 0)).join(':')
      || 'global-medical-chat'
    ).slice(0, 128);
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

      const policyResponse = this.buildPolicyResponse(
        input.channel,
        this.toMedicalUserRole(actorRole),
        roleClassification.confidence,
        modality,
        prePolicyResult.responseText,
        prePolicyResult.warnings,
      );
      const learningDecision = this.medicalChatLearningService.decide({
        query,
        role: input.role ?? 'INFERRED',
        mode,
        citations: [],
        policySeverity: prePolicyResult.severity,
      });
      this.medicalChatLearningService.record({
        request: input,
        query,
        mode,
        modality,
        citations: [],
        decision: learningDecision,
        outcome: 'blocked',
      });

      return {
        ...policyResponse,
        learning: {
          enabled: true,
          action: learningDecision.action,
          confidence: learningDecision.confidence,
          mode: 'controlled_dry_run',
        },
      };
    }

    const effectiveQuery = hasText
      ? query
      : `Interpretar hallazgos de imagen medica (${input.modalityHint ?? 'sin modalidad especificada'}) y contexto clinico.`;
    const sessionMemory = this.medicalChatLearningService.getSessionMemorySummary(effectiveSessionId);

    if (this.isDateTimeQuery(effectiveQuery)) {
      const runtimeContext = await this.runtimeToolsService.buildContext(effectiveQuery, input.country ?? 'AR');
      const responseText = this.buildDeterministicDateTimeResponse(runtimeContext.currentTimeText, runtimeContext.timezone);
      const aiRole = this.toMedicalUserRole(actorRole);
      const systemLearningSeed = this.aiService.getSystemLearningSeed();
      return {
        channel: input.channel ?? 'clinical_chat',
        role: aiRole,
        roleConfidence: roleClassification.confidence,
        modality,
        response: {
          text: responseText,
          citations: [],
        },
        guidance: {
          languageStyle: actorRole === 'PATIENT' ? 'simple' : 'technical',
          warnings: ['Contexto temporal en tiempo real provisto por herramientas operativas del sistema.'],
        },
        learning: {
          enabled: true,
          action: 'answer_with_official_sources',
          confidence: 1,
          mode: 'controlled_dry_run',
        },
      };
    }

    try {
      const doctorPatientContext = this.validateDoctorPatientContextOrThrow(
        input.doctorPatientContext,
        actorRole,
      );
      const patientClinicalSummary = this.resolveControlledPatientHistorySummary(
        input.activePatientClinicalHistory,
        doctorPatientContext,
        requestId,
      );

      const aiRole = this.toMedicalUserRole(actorRole);
      const runtimeContext = await this.runtimeToolsService.buildContext(
        effectiveQuery,
        input.country ?? 'AR',
      );
      const medical = await this.aiService.answerMedicalQuestion(
        sessionMemory ? `${effectiveQuery}\n\nMemoria de sesion clinica reciente:\n${sessionMemory}` : effectiveQuery,
        input.country ?? 'AR',
        input.topK ?? 6,
        input.imageBase64,
        input.imageMimeType,
        input.patientAge,
        input.modalityHint,
        aiRole,
        runtimeContext,
        patientClinicalSummary,
        requestId,
      );
      const learningDecision = this.medicalChatLearningService.decide({
        query: effectiveQuery,
        role: input.role ?? 'INFERRED',
        mode,
        citations: medical.citations,
        policySeverity: prePolicyResult.severity,
      });
      const systemLearningSeed = this.aiService.getSystemLearningSeed();

      const refinedAnswer = await this.aiService.refineMedicalText(medical.answer, requestId);
      this.logger.log(this.serializeLog({
        event: 'medical_chat.autocritique_applied',
        requestId,
        role: actorRole,
        mode,
      }));
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
      finalAnswer = this.aiService.normalizeMedicalTextForOutput(finalAnswer);

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
      warnings.push('Herramientas activas: hora real, clima operativo y fuentes oficiales controladas.');

      if (prePolicyResult.warnings.length > 0) {
        warnings.push(...prePolicyResult.warnings);
      }

      if (medical.citations.length === 0) {
        warnings.push('No se recuperaron fuentes confiables para esta consulta.');
      }
      const reminderResult = await this.tryScheduleReminderIfRequested(input, effectiveQuery, requestId, effectiveSessionId);
      if (reminderResult === 'scheduled') {
        warnings.push('Recordatorio solicitado: enviado a Google Calendar.');
      } else if (reminderResult === 'not_configured') {
        warnings.push('Recordatorio solicitado, pero Google Calendar no esta configurado en este entorno.');
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
        learning: {
          enabled: true,
          action: learningDecision.action,
          confidence: learningDecision.confidence,
          mode: 'controlled_dry_run',
        },
      };

      this.medicalChatLearningService.record({
        request: input,
        query: [effectiveQuery, systemLearningSeed].filter(Boolean).join('\n\nSystem learning seed:\n'),
        mode,
        modality,
        citations: medical.citations,
        decision: learningDecision,
        outcome: 'simulated',
        sessionId: effectiveSessionId,
        sessionTurn: { role: 'user', text: effectiveQuery },
      });
      this.medicalChatLearningService.record({
        request: input,
        query: [finalAnswer, systemLearningSeed].filter(Boolean).join('\n\nSystem learning seed:\n'),
        mode,
        modality,
        citations: medical.citations,
        decision: learningDecision,
        outcome: 'simulated',
        sessionId: effectiveSessionId,
        sessionTurn: { role: 'assistant', text: finalAnswer },
      });

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

      const fallbackResponse = this.buildPolicyResponse(
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
      const learningDecision = this.medicalChatLearningService.decide({
        query,
        role: input.role ?? 'INFERRED',
        mode,
        citations: [],
        fallback: true,
      });
      const systemLearningSeed = this.aiService.getSystemLearningSeed();
      this.medicalChatLearningService.record({
        request: input,
        query: [query, systemLearningSeed].filter(Boolean).join('\n\nSystem learning seed:\n'),
        mode,
        modality,
        citations: [],
        decision: learningDecision,
        outcome: 'fallback',
        sessionId: effectiveSessionId,
        sessionTurn: { role: 'user', text: query },
      });

      return {
        ...fallbackResponse,
        learning: {
          enabled: true,
          action: learningDecision.action,
          confidence: learningDecision.confidence,
          mode: 'controlled_dry_run',
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

  private validateDoctorPatientContextOrThrow(
    context: DoctorPatientContext | undefined,
    actorRole: ClinicalActorRole,
  ): DoctorPatientContext | undefined {
    if (actorRole !== 'DOCTOR') {
      return undefined;
    }

    if (!context) {
      throw new InvalidDoctorPatientContextError('doctorPatientContext is required for doctor chat');
    }

    if (!context.doctor_id?.trim()) {
      throw new InvalidDoctorPatientContextError('doctor_id is required');
    }

    if (!context.patient_id?.trim()) {
      throw new InvalidDoctorPatientContextError('patient_id is required');
    }

    const multiTenantEnabled = process.env.MB_CHAT_MULTI_TENANT === 'true';
    if (multiTenantEnabled && !context.tenant_id?.trim() && !context.clinic_id?.trim()) {
      throw new InvalidDoctorPatientContextError('tenant_id or clinic_id is required in multi-tenant mode');
    }

    const activeEncounterRequired = process.env.MB_CHAT_REQUIRE_ACTIVE_ENCOUNTER !== 'false';
    if (activeEncounterRequired && !context.encounter_id?.trim() && !context.appointment_id?.trim()) {
      throw new InvalidDoctorPatientContextError('encounter_id or appointment_id is required for active patient context');
    }

    return {
      ...context,
      doctor_id: context.doctor_id.trim(),
      patient_id: context.patient_id.trim(),
      tenant_id: context.tenant_id?.trim(),
      clinic_id: context.clinic_id?.trim(),
      encounter_id: context.encounter_id?.trim(),
      appointment_id: context.appointment_id?.trim(),
    };
  }

  private resolveControlledPatientHistorySummary(
    history: ActivePatientClinicalHistory | undefined,
    context: DoctorPatientContext | undefined,
    requestId: string,
  ): string | undefined {
    if (!context || !history) {
      return undefined;
    }

    if (!history.doctor_id?.trim() || history.doctor_id.trim() !== context.doctor_id) {
      throw new PatientContextAccessDeniedError('doctor_id mismatch for active patient history');
    }

    if (!history.patient_id?.trim() || history.patient_id.trim() !== context.patient_id) {
      throw new PatientContextAccessDeniedError('patient_id mismatch for active patient history');
    }

    if (context.tenant_id && history.tenant_id?.trim() !== context.tenant_id) {
      throw new PatientContextAccessDeniedError('patient belongs to another tenant');
    }

    if (context.clinic_id && history.clinic_id?.trim() !== context.clinic_id) {
      throw new PatientContextAccessDeniedError('patient belongs to another clinic');
    }

    if (context.encounter_id && history.encounter_id?.trim() !== context.encounter_id) {
      throw new PatientContextAccessDeniedError('patient has no active encounter in current context');
    }

    if (context.appointment_id && history.appointment_id?.trim() !== context.appointment_id) {
      throw new PatientContextAccessDeniedError('patient has no active appointment in current context');
    }

    if (!history.is_sanitized) {
      throw new ProviderPhiNotAllowedError('Clinical history must be sanitized before AI provider usage');
    }

    const summary = history.clinical_summary?.trim();
    if (!summary) {
      return undefined;
    }

    const controlledSummary = summary.slice(0, 900);
    assertGroqPhiAllowedOrThrow(controlledSummary, {
      correlation_id: requestId,
      method: 'patientClinicalHistorySummary',
    });

    return controlledSummary;
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

    const coded = (error as Error & { code?: unknown }).code;
    if (typeof coded === 'string' && coded.trim().length > 0) {
      const safeCode = coded.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 80);
      if (safeCode) {
        return safeCode;
      }
    }

    const safeClass = error.name.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 80);
    return safeClass || 'Error';
  }

  private serializeLog(payload: Record<string, unknown>): string {
    return JSON.stringify(payload);
  }

  private isDateTimeQuery(text: string): boolean {
    const normalized = String(text ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const hasHora = /\bhora\b/.test(normalized);
    const hasFecha = /\bfecha\b/.test(normalized) || /\bdia\b/.test(normalized);
    if (hasHora && hasFecha) return true;
    if (normalized.length <= 40 && (hasHora || hasFecha)) return true;
    return /\b(que|cual)\s+(fecha|hora)\s+es\b/.test(normalized);
  }

  private buildDeterministicDateTimeResponse(currentTimeText: string, timezone: string): string {
    const parsed = new Date();
    const date = new Intl.DateTimeFormat('es-AR', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'long',
    }).format(parsed);
    const time = new Intl.DateTimeFormat('es-AR', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(parsed);
    return [
      'Contexto temporal en tiempo real:',
      `Fecha: ${date}`,
      `Hora: ${time}`,
      `Zona horaria: ${timezone}`,
      `Referencia operativa: ${currentTimeText}`,
    ].join('\n');
  }

  private async tryScheduleReminderIfRequested(
    input: MedicalAssistantRequest,
    query: string,
    requestId: string,
    sessionId: string,
  ): Promise<'none' | 'scheduled' | 'not_configured'> {
    const normalized = query.toLowerCase();
    const wantsReminder = /(recordame|recordar|recordatorio|agendame|agendar|agenda)/i.test(normalized);
    if (!wantsReminder) {
      return 'none';
    }

    const webhookUrl = process.env.MEDICAL_CHAT_GOOGLE_CALENDAR_WEBHOOK_URL?.trim();
    if (!webhookUrl) {
      return 'not_configured';
    }

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          requestId,
          sessionId,
          channel: input.channel ?? 'clinical_chat',
          role: input.role ?? 'INFERRED',
          query: query.slice(0, 1500),
          createdAt: new Date().toISOString(),
        }),
      });
      return res.ok ? 'scheduled' : 'not_configured';
    } catch {
      return 'not_configured';
    }
  }
}
