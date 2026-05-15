import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AiService } from '../ai/ai.service';
import { MedicalUserRole } from '../ai/classification.service';
import { BrainService } from '../brain/brain.service';
import { IncidentPayload } from '../common/types/brain.types';
import { MedicalAssistantRequest, MedicalAssistantResponse } from './medical-assistant.types';

@Injectable()
export class MedicalAssistantService {
  constructor(
    private readonly aiService: AiService,
    private readonly brainService: BrainService,
  ) {}

  async handleMedicalChatMessage(input: MedicalAssistantRequest): Promise<MedicalAssistantResponse> {
    const query = (input.query ?? '').trim();
    const hasText = query.length > 0;
    const hasImage = typeof input.imageBase64 === 'string' && input.imageBase64.trim().length > 0;

    const modality: 'text' | 'image' | 'multimodal' = hasText && hasImage
      ? 'multimodal'
      : hasImage
        ? 'image'
        : 'text';

    const roleHint = this.normalizeUserTypeHint(input.userTypeHint);
    const roleClassification = roleHint
      ? { role: roleHint, confidence: 1 }
      : this.aiService.classifyMedicalRole(query || 'consulta medica por chat clinico');

    const effectiveQuery = hasText
      ? query
      : `Interpretar hallazgos de imagen medica (${input.modalityHint ?? 'sin modalidad especificada'}) y contexto clinico.`;

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

    const refinedAnswer = await this.aiService.refineMedicalText(medical.answer);

    let metabrain: MedicalAssistantResponse['metabrain'] | undefined;

    // For text modality we attach ML+rules decision trace in dry-run mode.
    if (hasText) {
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

    return {
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
}
