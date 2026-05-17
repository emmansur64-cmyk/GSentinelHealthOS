import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { MedicalCitation } from '../../knowledge/types';
import {
  MedicalAssistantRequest,
  MedicalAssistantRole,
} from '../medical-assistant.types';
import { ClinicalAssistantMode } from '../clinical-policy';
import type { DoctorPatientContext } from '../doctor-patient-context.contract';
import {
  ClinicalTrigger,
  ClinicalTriggerSeverityHint,
  detect_critical_clinical_triggers,
} from './critical-clinical-triggers';

export type MedicalChatControlledAction =
  | 'answer_with_official_sources'
  | 'ask_for_minimum_context'
  | 'escalate_emergency'
  | 'safe_fallback'
  | 'professional_support_dry_run';

export interface MedicalChatControlledDecision {
  action: MedicalChatControlledAction;
  confidence: number;
  allowed: boolean;
  execution: 'dry_run';
  reason: string;
}

export type HybridMedicalLearningSource = 'groq_teacher' | 'doctor_teaching' | 'official_source' | 'system_correction';

export type HybridMedicalLearningType =
  | 'response_style'
  | 'clinical_language'
  | 'official_reference'
  | 'safety_correction'
  | 'doctor_preference'
  | 'rejected_unsafe';

export type HybridMedicalValidationStatus = 'pending' | 'auto_safe' | 'doctor_validated' | 'rejected';

export type HybridMedicalReuseScope = 'same_doctor' | 'same_tenant' | 'global_safe' | 'none';

export interface HybridMedicalLearningRecord {
  id: string;
  timestamp: string;
  recordedAt: string;
  source: HybridMedicalLearningSource;
  tenantId: string;
  doctorId: string;
  patientIdHash?: string;
  sessionId: string;
  medicalDomain: string;
  learningType: HybridMedicalLearningType;
  sanitizedPromptSummary: string;
  sanitizedTeacherAnswerSummary: string;
  extractedClinicalConcepts: string[];
  extractedProfessionalPhrases: string[];
  officialCitations: MedicalCitation[];
  safetyFlags: string[];
  confidence: number;
  allowedForReuse: boolean;
  allowedForTraining: boolean;
  validationStatus: HybridMedicalValidationStatus;
  reuseScope: HybridMedicalReuseScope;
  rawTextStored: false;
  metadata: Record<string, unknown>;
  role: MedicalAssistantRole | 'INFERRED';
  mode: ClinicalAssistantMode;
  country: string;
  modality: 'text' | 'image' | 'multimodal';
  concepts: string[];
  citationCount: number;
  officialSourceUrls: string[];
  decision: MedicalChatControlledDecision;
  outcome: 'simulated' | 'blocked' | 'fallback';
  queryHash: string;
  explicitTeaching?: {
    hash: string;
    sanitizedText: string;
  };
}

export type MedicalChatLearningRecord = HybridMedicalLearningRecord;

export type HybridLocalAnswer = {
  used: boolean;
  confidence: number;
  answer?: string;
  citations: MedicalCitation[];
  matchedRecordIds: string[];
};

export type HybridLearningMetrics = {
  totalTeacherResponses: number;
  acceptedLearningRecords: number;
  rejectedLearningRecords: number;
  doctorValidatedRecords: number;
  reusablePatterns: number;
  unsafeRejectedPatterns: number;
  semanticRecallHitRate: number;
  localAnswerAttempted: number;
  groqFallbackUsed: number;
  localAnswerConfidence: number;
  teacherDependencyRatio: number;
};

type HybridLearningInput = {
  request: MedicalAssistantRequest;
  query: string;
  mode: ClinicalAssistantMode;
  modality: 'text' | 'image' | 'multimodal';
  citations: MedicalCitation[];
  decision: MedicalChatControlledDecision;
  outcome: MedicalChatLearningRecord['outcome'];
  sessionId?: string;
  teacherAnswer?: string;
  source?: HybridMedicalLearningSource;
  localAnswerAttempted?: boolean;
  localAnswerConfidence?: number;
  groqFallbackUsed?: boolean;
  semanticRecallHit?: boolean;
  matchedRecordIds?: string[];
};

type LongTermMemoryProcessingResult = {
  safePromptSummary: string;
  safeTeacherSummary: string;
  criticalClinicalTriggers: ClinicalTrigger[];
  triggerAudit: {
    enabled: boolean;
    minSeverity: ClinicalTriggerSeverityHint;
    detected: number;
    stored: number;
    rawTextStorageAllowed: boolean;
    rawTextStored: false;
  };
};

type TextSanitization = {
  value: string;
  flags: string[];
};

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)/g;
const DOCUMENT_RE = /\b(?:dni|documento|passport|pasaporte|ssn|cuit|cuil|rut)\s*[:#-]?\s*[A-Z0-9.\-]{5,}\b/gi;
const ADDRESS_RE = /\b(?:direccion|address|domicilio|calle|avenida|av\.?|street)\b[^,.\n]{0,80}/gi;
const NAME_HINT_RE = /\b(?:paciente|doctor|doctora|dra\.?|dr\.?|nombre)\s*[:\-]?\s*[a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,2}/gi;
const DATE_RE = /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g;
const HTML_RE = /<[^>]*>/g;
const URL_WITH_QUERY_RE = /\bhttps?:\/\/[^\s?#]+(?:\?[^\s]*)?/gi;


@Injectable()
export class MedicalChatLearningService implements OnModuleInit {
  private static readonly MAX_SUMMARY_LENGTH = 280;
  private static readonly MIN_LOCAL_CONFIDENCE = 0.82;
  private static readonly MAX_MEMORY = 500;

  private readonly logger = new Logger(MedicalChatLearningService.name);
  private readonly records: MedicalChatLearningRecord[] = [];
  private readonly storagePath = this.resolveStoragePath();
  constructor() {}

  onModuleInit(): void {
    this.logger.log(`[MedicalChatLearning] storage_path=${this.storagePath}`);
    this.loadFromDisk();
  }

  decide(input: {
    query: string;
    role: MedicalAssistantRole | 'INFERRED';
    mode: ClinicalAssistantMode;
    citations: MedicalCitation[];
    policySeverity?: string;
    fallback?: boolean;
  }): MedicalChatControlledDecision {
    if (input.fallback) {
      return {
        action: 'safe_fallback',
        confidence: 1,
        allowed: true,
        execution: 'dry_run',
        reason: 'provider_or_runtime_error_safe_response',
      };
    }

    if (input.policySeverity === 'CRITICAL') {
      return {
        action: 'escalate_emergency',
        confidence: 1,
        allowed: true,
        execution: 'dry_run',
        reason: 'critical_policy_short_circuit',
      };
    }

    if (input.policySeverity === 'WARNING') {
      return {
        action: 'ask_for_minimum_context',
        confidence: 0.95,
        allowed: true,
        execution: 'dry_run',
        reason: 'clinical_policy_requires_more_context_or_boundary',
      };
    }

    const officialEvidence = input.citations.length > 0;
    const professional = input.role === MedicalAssistantRole.DOCTOR
      || input.mode === 'doctor_professional';

    return {
      action: professional ? 'professional_support_dry_run' : 'answer_with_official_sources',
      confidence: officialEvidence ? 0.9 : 0.72,
      allowed: true,
      execution: 'dry_run',
      reason: officialEvidence
        ? 'official_sources_available_controlled_answer'
        : 'no_citations_available_answer_kept_safe',
    };
  }

  record(input: HybridLearningInput): MedicalChatLearningRecord {
    const role = input.request.role ?? 'INFERRED';
    const country = input.request.country ?? 'AR';
    const sessionId = (input.sessionId?.trim() || 'global-medical-chat').slice(0, 128);
    const scope = this.resolveScope(input.request, role, sessionId);
    const promptSanitization = this.sanitizeText(input.query);
    const promptConcepts = this.extractConcepts(promptSanitization.value);
    const promptSummary = this.buildPromptSummary(promptConcepts, promptSanitization.value);
    const teacherSanitization = this.sanitizeText(input.teacherAnswer ?? '');
    const explicitTeaching = this.extractExplicitTeaching(promptSanitization.value);
    const extractedProfessionalPhrases = this.extractProfessionalPhrases(teacherSanitization.value);
    const teacherSummary = this.buildTeacherSummary(teacherSanitization.value, extractedProfessionalPhrases, input.citations);
    const longTermProcessing = this._procesar_memoria_largo_plazo({
      query: promptSanitization.value,
      teacherAnswer: teacherSanitization.value,
      promptSummary,
      teacherSummary,
    });
    const learningType = this.resolveLearningType({
      role,
      query: promptSanitization.value,
      teacherAnswer: teacherSanitization.value,
      citations: input.citations,
      decision: input.decision,
      outcome: input.outcome,
      source: input.source,
      explicitTeaching,
    });
    const safetyFlags = Array.from(new Set([
      ...promptSanitization.flags,
      ...teacherSanitization.flags,
      ...(input.citations.length === 0 ? ['no_official_citations'] : []),
      ...(input.groqFallbackUsed ? ['groq_fallback_used'] : []),
      ...(input.semanticRecallHit ? ['semantic_recall_hit'] : ['semantic_recall_miss']),
      ...(explicitTeaching ? ['explicit_doctor_teaching'] : []),
      ...(role === MedicalAssistantRole.PATIENT ? ['patient_facing'] : []),
    ]));
    const validationStatus = this.resolveValidationStatus({
      role,
      learningType,
      source: input.source,
      citations: input.citations,
      safetyFlags,
      decision: input.decision,
      outcome: input.outcome,
      explicitTeaching: Boolean(explicitTeaching),
      query: promptSanitization.value,
    });
    const reuseScope = this.resolveReuseScope({
      learningType,
      validationStatus,
      tenantId: scope.tenantId,
      explicitTeaching: Boolean(explicitTeaching),
    });
    const allowedForTraining = this.isAllowedForTraining({
      role,
      validationStatus,
      learningType,
      safetyFlags,
      citations: input.citations,
      query: promptSanitization.value,
      teacherSummary,
    });
    const allowedForReuse = this.isAllowedForReuse({
      validationStatus,
      learningType,
      reuseScope,
      teacherSummary,
    });
    const conceptPool = Array.from(new Set([
      ...promptConcepts,
      ...this.extractConcepts(teacherSanitization.value),
    ])).slice(0, 16);
    const timestamp = new Date().toISOString();
    const source = input.source ?? this.resolveSource(role, input.citations, explicitTeaching, input.outcome);
    const record: MedicalChatLearningRecord = {
      id: `medlearn-${Date.now()}-${this.hash(`${promptSummary}|${teacherSummary}|${Math.random()}`).slice(0, 8)}`,
      timestamp,
      recordedAt: timestamp,
      source,
      tenantId: scope.tenantId,
      doctorId: scope.doctorId,
      ...(scope.patientIdHash ? { patientIdHash: scope.patientIdHash } : {}),
      sessionId,
      medicalDomain: this.resolveMedicalDomain(conceptPool, input.modality),
      learningType,
      sanitizedPromptSummary: longTermProcessing.safePromptSummary,
      sanitizedTeacherAnswerSummary: longTermProcessing.safeTeacherSummary,
      extractedClinicalConcepts: conceptPool,
      extractedProfessionalPhrases,
      officialCitations: input.citations.slice(0, 6),
      safetyFlags,
      confidence: Number(input.decision.confidence.toFixed(2)),
      allowedForReuse,
      allowedForTraining,
      validationStatus,
      reuseScope,
      rawTextStored: false,
      metadata: {
        citationCount: input.citations.length,
        modality: input.modality,
        outcome: input.outcome,
        decision: input.decision,
        localAnswerAttempted: Boolean(input.localAnswerAttempted),
        localAnswerConfidence: input.localAnswerConfidence ?? 0,
        groqFallbackUsed: Boolean(input.groqFallbackUsed),
        semanticRecallHit: Boolean(input.semanticRecallHit),
        matchedRecordIds: input.matchedRecordIds?.slice(0, 10) ?? [],
        criticalClinicalTriggers: longTermProcessing.criticalClinicalTriggers,
        criticalClinicalTriggerAudit: longTermProcessing.triggerAudit,
      },
      role,
      mode: input.mode,
      country,
      modality: input.modality,
      concepts: conceptPool,
      citationCount: input.citations.length,
      officialSourceUrls: input.citations.map((citation) => citation.url).slice(0, 12),
      decision: input.decision,
      outcome: input.outcome,
      queryHash: this.hash(promptSanitization.value),
      ...(explicitTeaching ? { explicitTeaching } : {}),
    };

    this.records.push(record);
    if (this.records.length > MedicalChatLearningService.MAX_MEMORY) {
      this.records.shift();
    }

    this.persist(record);
    return record;
  }

  async recordAndTrain(input: HybridLearningInput): Promise<MedicalChatLearningRecord> {
    return this.record(input);
  }

  getRecent(limit = 20): MedicalChatLearningRecord[] {
    return this.records.slice(-Math.max(1, limit));
  }

  getSessionMemorySummary(sessionId: string | undefined, limit = 8): string | undefined {
    const id = (sessionId ?? '').trim();
    const pool = id
      ? this.records.filter((record) => record.sessionId === id)
      : this.records;

    const combined = pool
      .filter((record) => record.allowedForReuse || record.validationStatus === 'doctor_validated')
      .slice(-Math.max(1, limit))
      .flatMap((record) => {
        const items = [
          record.sanitizedPromptSummary,
          record.sanitizedTeacherAnswerSummary,
        ].filter((value) => value.trim().length > 0);
        return items.map((value) => `${record.source}: ${value}`);
      });

    if (combined.length === 0) return undefined;
    return combined.join('\n').slice(0, 3000);
  }

  attemptLocalAnswer(input: {
    query: string;
    role: MedicalAssistantRole | 'INFERRED';
    mode: ClinicalAssistantMode;
    sessionId?: string;
    doctorPatientContext?: DoctorPatientContext;
  }): HybridLocalAnswer {
    const matches = this.recallReusableKnowledge({
      query: input.query,
      sessionId: input.sessionId,
      role: input.role,
      doctorPatientContext: input.doctorPatientContext,
      limit: 4,
    });
    const confidence = this.estimateLocalAnswerConfidence(matches, input.role, input.mode);

    if (input.role !== MedicalAssistantRole.DOCTOR || confidence < MedicalChatLearningService.MIN_LOCAL_CONFIDENCE) {
      return {
        used: false,
        confidence,
        citations: matches.flatMap((record) => record.officialCitations).slice(0, 3),
        matchedRecordIds: matches.map((record) => record.id),
      };
    }

    const insights = matches
      .flatMap((record) => [record.sanitizedTeacherAnswerSummary, ...record.extractedProfessionalPhrases])
      .filter((value) => value.trim().length > 0)
      .slice(0, 4);
    if (insights.length === 0) {
      return {
        used: false,
        confidence,
        citations: matches.flatMap((record) => record.officialCitations).slice(0, 3),
        matchedRecordIds: matches.map((record) => record.id),
      };
    }

    const answer = [
      'Memoria clinica validada recuperada para soporte local:',
      ...insights.map((item) => `- ${item}`),
      'Usar como apoyo no diagnostico y validar con contexto actual del paciente y guias locales.',
    ].join('\n');

    return {
      used: true,
      confidence,
      answer,
      citations: this.dedupeCitations(matches.flatMap((record) => record.officialCitations)).slice(0, 3),
      matchedRecordIds: matches.map((record) => record.id),
    };
  }

  getHybridLearningMetrics(): HybridLearningMetrics {
    const totalTeacherResponses = this.records.filter((record) => record.source === 'groq_teacher').length;
    const acceptedLearningRecords = this.records.filter((record) => record.allowedForTraining).length;
    const rejectedLearningRecords = this.records.filter((record) => record.validationStatus === 'rejected').length;
    const doctorValidatedRecords = this.records.filter((record) => record.validationStatus === 'doctor_validated').length;
    const reusablePatterns = this.records.filter((record) => record.allowedForReuse).length;
    const unsafeRejectedPatterns = this.records.filter((record) => record.learningType === 'rejected_unsafe').length;
    const localAnswerAttempts = this.records.filter((record) => Boolean(record.metadata.localAnswerAttempted));
    const recallAttempts = this.records.filter((record) => record.metadata.semanticRecallHit !== undefined);
    const recallHits = recallAttempts.filter((record) => Boolean(record.metadata.semanticRecallHit)).length;
    const groqFallbackUsed = this.records.filter((record) => Boolean(record.metadata.groqFallbackUsed)).length;
    const averageLocalConfidence = localAnswerAttempts.length === 0
      ? 0
      : Number((localAnswerAttempts.reduce((acc, record) => {
          const value = typeof record.metadata.localAnswerConfidence === 'number'
            ? record.metadata.localAnswerConfidence
            : 0;
          return acc + value;
        }, 0) / localAnswerAttempts.length).toFixed(2));

    return {
      totalTeacherResponses,
      acceptedLearningRecords,
      rejectedLearningRecords,
      doctorValidatedRecords,
      reusablePatterns,
      unsafeRejectedPatterns,
      semanticRecallHitRate: recallAttempts.length === 0 ? 0 : Number((recallHits / recallAttempts.length).toFixed(2)),
      localAnswerAttempted: localAnswerAttempts.length,
      groqFallbackUsed,
      localAnswerConfidence: averageLocalConfidence,
      teacherDependencyRatio: Number((groqFallbackUsed / Math.max(1, localAnswerAttempts.length)).toFixed(2)),
    };
  }

  private isExplicitMemoryRequest(text: string): boolean {
    return /\b(aprende|aprend[eé]|record[aá]|acordate|acuerdate|memoriza|memoriz[aá]|guarda|guardar|agend[aá]|anota)\b/i.test(text);
  }

  private sanitizeExplicitMemory(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);
  }

  getAdaptiveSourceHints(limit = 12): string[] {
    const scoreByDomain = new Map<string, number>();

    for (const record of this.records) {
      if (record.outcome === 'fallback') {
        continue;
      }

      const baseScore = record.outcome === 'simulated' ? 2 : 1;
      const citationBoost = Math.min(3, record.citationCount);
      const recordScore = baseScore + citationBoost;

      for (const rawUrl of record.officialSourceUrls) {
        try {
          const domain = new URL(rawUrl).hostname.toLowerCase();
          scoreByDomain.set(domain, (scoreByDomain.get(domain) ?? 0) + recordScore);
        } catch {
          // Ignore malformed URLs in append-only history.
        }
      }
    }

    return [...scoreByDomain.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.max(1, limit))
      .map(([domain]) => domain);
  }

  private loadFromDisk(): void {
    try {
      if (!existsSync(this.storagePath)) {
        return;
      }

      const rows = readFileSync(this.storagePath, 'utf8')
        .split(/\r?\n/)
        .filter(Boolean)
        .slice(-MedicalChatLearningService.MAX_MEMORY);

      for (const row of rows) {
        try {
          const normalized = this.normalizeLoadedRecord(JSON.parse(row) as Record<string, unknown>);
          if (normalized) {
            this.records.push(normalized);
          }
        } catch {
          // Skip corrupt rows; append-only memory must not block runtime.
        }
      }

      this.logger.log(`[MedicalChatLearning] Loaded ${this.records.length} controlled records`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[MedicalChatLearning] load failed: ${msg}`);
    }
  }

  private persist(record: MedicalChatLearningRecord): void {
    try {
      mkdirSync(dirname(this.storagePath), { recursive: true });
      appendFileSync(this.storagePath, `${JSON.stringify(record)}\n`, 'utf8');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[MedicalChatLearning] persist failed: ${msg}`);
    }
  }

  private extractExplicitTeaching(query: string): MedicalChatLearningRecord['explicitTeaching'] | undefined {
    const normalized = query.trim();
    if (!this.isExplicitMemoryRequest(normalized)) {
      return undefined;
    }

    const sanitized = this.sanitizeExplicitMemory(normalized);

    return {
      hash: this.hash(sanitized),
      sanitizedText: sanitized,
    };
  }

  private extractConcepts(query: string): string[] {
    const stopwords = new Set([
      'para',
      'como',
      'con',
      'del',
      'las',
      'los',
      'una',
      'que',
      'por',
      'paciente',
      'doctor',
      'medico',
      'medica',
      'consulta',
    ]);

    const concepts = query
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .match(/[a-z0-9]{4,}/g) ?? [];

    return Array.from(new Set(concepts.filter((word) => !stopwords.has(word)))).slice(0, 12);
  }

  private recallReusableKnowledge(input: {
    query: string;
    sessionId?: string;
    role: MedicalAssistantRole | 'INFERRED';
    doctorPatientContext?: DoctorPatientContext;
    limit: number;
  }): MedicalChatLearningRecord[] {
    const queryConcepts = this.extractConcepts(input.query);
    const sessionId = input.sessionId?.trim();
    const tenantId = input.doctorPatientContext?.tenant_id?.trim();
    const doctorId = input.doctorPatientContext?.doctor_id?.trim();

    return this.records
      .filter((record) => record.allowedForReuse)
      .filter((record) => this.matchesReuseScope(record, { sessionId, tenantId, doctorId }))
      .map((record) => ({
        record,
        score: this.scoreRecordMatch(record, queryConcepts, sessionId, tenantId, doctorId),
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, Math.max(1, input.limit))
      .map((entry) => entry.record);
  }

  private matchesReuseScope(
    record: MedicalChatLearningRecord,
    scope: { sessionId?: string; tenantId?: string; doctorId?: string },
  ): boolean {
    if (record.reuseScope === 'global_safe') {
      return true;
    }
    if (record.reuseScope === 'same_tenant') {
      return Boolean(scope.tenantId) && record.tenantId === scope.tenantId;
    }
    if (record.reuseScope === 'same_doctor') {
      if (scope.sessionId && record.sessionId === scope.sessionId) {
        return true;
      }
      return Boolean(scope.doctorId) && record.doctorId === scope.doctorId;
    }
    return false;
  }

  private scoreRecordMatch(
    record: MedicalChatLearningRecord,
    queryConcepts: string[],
    sessionId?: string,
    tenantId?: string,
    doctorId?: string,
  ): number {
    const conceptHits = queryConcepts.filter((concept) => record.extractedClinicalConcepts.includes(concept)).length;
    const phraseHits = queryConcepts.filter((concept) => record.sanitizedTeacherAnswerSummary.toLowerCase().includes(concept)).length;
    const sessionBoost = sessionId && record.sessionId === sessionId ? 3 : 0;
    const doctorBoost = doctorId && record.doctorId === doctorId ? 2 : 0;
    const tenantBoost = tenantId && record.tenantId === tenantId ? 1 : 0;
    const validationBoost = record.validationStatus === 'doctor_validated' ? 3 : record.validationStatus === 'auto_safe' ? 2 : 0;
    return conceptHits * 2 + phraseHits + sessionBoost + doctorBoost + tenantBoost + validationBoost;
  }

  private estimateLocalAnswerConfidence(
    records: MedicalChatLearningRecord[],
    role: MedicalAssistantRole | 'INFERRED',
    mode: ClinicalAssistantMode,
  ): number {
    if (records.length === 0 || role !== MedicalAssistantRole.DOCTOR) {
      return 0;
    }

    const base = mode === 'doctor_professional' ? 0.58 : 0.45;
    const densityBonus = Math.min(0.12, records.length * 0.05);
    const validationBonus = records.reduce((acc, record) => {
      if (record.validationStatus === 'doctor_validated') return acc + 0.18;
      if (record.validationStatus === 'auto_safe') return acc + 0.12;
      return acc + 0.03;
    }, 0);
    const citationBonus = Math.min(0.15, records.flatMap((record) => record.officialCitations).length * 0.05);
    return Number(Math.min(0.96, base + densityBonus + validationBonus + citationBonus).toFixed(2));
  }

  private resolveScope(
    request: MedicalAssistantRequest,
    role: MedicalAssistantRole | 'INFERRED',
    sessionId: string,
  ): { tenantId: string; doctorId: string; patientIdHash?: string } {
    const context = request.doctorPatientContext;
    const tenantId = context?.tenant_id?.trim() || `session:${this.hash(sessionId).slice(0, 12)}`;
    const doctorId = context?.doctor_id?.trim()
      || `${String(role).toLowerCase()}-${this.hash(sessionId).slice(0, 12)}`;
    const patientId = context?.patient_id?.trim();

    return {
      tenantId,
      doctorId,
      ...(patientId ? { patientIdHash: this.hash(patientId) } : {}),
    };
  }

  private sanitizeText(text: string): TextSanitization {
    if (!text.trim()) {
      return { value: '', flags: [] };
    }

    const flags = new Set<string>();
    let sanitized = text;
    const redact = (pattern: RegExp, marker: string): void => {
      sanitized = sanitized.replace(pattern, () => {
        flags.add(marker);
        return `[${marker}]`;
      });
    };

    redact(HTML_RE, 'html_removed');
    redact(EMAIL_RE, 'phi_email_redacted');
    redact(PHONE_RE, 'phi_phone_redacted');
    redact(DOCUMENT_RE, 'phi_document_redacted');
    redact(ADDRESS_RE, 'phi_address_redacted');
    redact(NAME_HINT_RE, 'phi_name_hint_redacted');
    redact(DATE_RE, 'phi_date_redacted');
    sanitized = sanitized.replace(URL_WITH_QUERY_RE, (url) => {
      flags.add('url_query_redacted');
      return url.split('?')[0];
    });

    sanitized = sanitized
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      value: sanitized.slice(0, 1200),
      flags: [...flags],
    };
  }

  private _procesar_memoria_largo_plazo(input: {
    query: string;
    teacherAnswer: string;
    promptSummary: string;
    teacherSummary: string;
  }): LongTermMemoryProcessingResult {
    const triggersEnabled = this.readEnvBool('CLINICAL_CRITICAL_TRIGGERS_ENABLED', true);
    const minSeverity = this.readMinSeverityEnv('CLINICAL_CRITICAL_TRIGGERS_MIN_SEVERITY', 'medium');
    const storeRawText = this.readEnvBool('CLINICAL_MEMORY_STORE_RAW_TEXT', false);

    const sourceForDetection = `${input.query}\n${input.teacherAnswer}`.trim();
    const detected = triggersEnabled
      ? detect_critical_clinical_triggers(sourceForDetection, null)
      : [];
    const filtered = detected.filter((trigger) => this.isSeverityAtLeast(trigger.severity_hint, minSeverity));
    const deduped = this.dedupeClinicalTriggers(filtered);

    return {
      safePromptSummary: input.promptSummary,
      safeTeacherSummary: input.teacherSummary,
      criticalClinicalTriggers: deduped,
      triggerAudit: {
        enabled: triggersEnabled,
        minSeverity,
        detected: detected.length,
        stored: deduped.length,
        rawTextStorageAllowed: storeRawText,
        rawTextStored: false,
      },
    };
  }

  private buildPromptSummary(concepts: string[], fallback: string): string {
    if (concepts.length > 0) {
      return `Consulta resumida: ${concepts.slice(0, 8).join(', ')}`.slice(0, MedicalChatLearningService.MAX_SUMMARY_LENGTH);
    }
    return fallback.slice(0, MedicalChatLearningService.MAX_SUMMARY_LENGTH);
  }

  private buildTeacherSummary(answer: string, phrases: string[], citations: MedicalCitation[]): string {
    if (phrases.length > 0) {
      return phrases.join(' ').slice(0, MedicalChatLearningService.MAX_SUMMARY_LENGTH);
    }
    if (citations.length > 0) {
      return `Respuesta apoyada en ${citations.map((citation) => citation.title).slice(0, 2).join('; ')}`
        .slice(0, MedicalChatLearningService.MAX_SUMMARY_LENGTH);
    }
    return answer.slice(0, MedicalChatLearningService.MAX_SUMMARY_LENGTH);
  }

  private extractProfessionalPhrases(text: string): string[] {
    const candidates = text
      .split(/(?<=[.!?])\s+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => /(evaluar|considerar|priorizar|vigilar|derivar|escalar|guias|evidencia|contexto|alarma|urgencia|contraind)/i.test(item));

    return Array.from(new Set(candidates.map((item) => item.slice(0, 180)))).slice(0, 4);
  }

  private resolveSource(
    role: MedicalAssistantRole | 'INFERRED',
    citations: MedicalCitation[],
    explicitTeaching: MedicalChatLearningRecord['explicitTeaching'] | undefined,
    outcome: MedicalChatLearningRecord['outcome'],
  ): HybridMedicalLearningSource {
    if (explicitTeaching && role === MedicalAssistantRole.DOCTOR) {
      return 'doctor_teaching';
    }
    if (outcome !== 'simulated') {
      return 'system_correction';
    }
    if (citations.length > 0) {
      return 'groq_teacher';
    }
    return 'system_correction';
  }

  private resolveLearningType(input: {
    role: MedicalAssistantRole | 'INFERRED';
    query: string;
    teacherAnswer: string;
    citations: MedicalCitation[];
    decision: MedicalChatControlledDecision;
    outcome: MedicalChatLearningRecord['outcome'];
    source?: HybridMedicalLearningSource;
    explicitTeaching?: MedicalChatLearningRecord['explicitTeaching'];
  }): HybridMedicalLearningType {
    if (!input.decision.allowed || input.outcome !== 'simulated') {
      return 'rejected_unsafe';
    }
    if (input.explicitTeaching && input.role === MedicalAssistantRole.DOCTOR) {
      return /prefer/i.test(input.query) ? 'doctor_preference' : 'doctor_preference';
    }
    if (input.citations.length > 0) {
      return 'official_reference';
    }
    if (/alarma|urgencia|emergencia|no puedo|derivar|escalar/i.test(input.teacherAnswer)) {
      return 'safety_correction';
    }
    if (input.role === MedicalAssistantRole.DOCTOR) {
      return 'clinical_language';
    }
    return 'response_style';
  }

  private resolveValidationStatus(input: {
    role: MedicalAssistantRole | 'INFERRED';
    learningType: HybridMedicalLearningType;
    source?: HybridMedicalLearningSource;
    citations: MedicalCitation[];
    safetyFlags: string[];
    decision: MedicalChatControlledDecision;
    outcome: MedicalChatLearningRecord['outcome'];
    explicitTeaching: boolean;
    query: string;
  }): HybridMedicalValidationStatus {
    const highRisk = input.learningType === 'rejected_unsafe'
      || !input.decision.allowed
      || input.outcome !== 'simulated'
      || input.role === MedicalAssistantRole.PATIENT
      || this.looksDiagnosticOrPatientSpecific(input.query)
      || input.safetyFlags.some((flag) => flag.startsWith('phi_'));

    if (highRisk) {
      return 'rejected';
    }
    if (input.explicitTeaching) {
      return 'doctor_validated';
    }
    if (input.learningType === 'official_reference' || input.learningType === 'safety_correction') {
      return input.citations.length > 0 || input.learningType === 'safety_correction' ? 'auto_safe' : 'pending';
    }
    return input.citations.length > 0 && input.role === MedicalAssistantRole.DOCTOR ? 'auto_safe' : 'pending';
  }

  private resolveReuseScope(input: {
    learningType: HybridMedicalLearningType;
    validationStatus: HybridMedicalValidationStatus;
    tenantId: string;
    explicitTeaching: boolean;
  }): HybridMedicalReuseScope {
    if (input.validationStatus === 'rejected') {
      return 'none';
    }
    if (input.explicitTeaching || input.learningType === 'doctor_preference' || input.learningType === 'clinical_language') {
      return 'same_doctor';
    }
    if (input.learningType === 'official_reference' || input.learningType === 'safety_correction') {
      return input.tenantId.startsWith('session:') ? 'same_doctor' : 'global_safe';
    }
    return 'none';
  }

  private isAllowedForTraining(input: {
    role: MedicalAssistantRole | 'INFERRED';
    validationStatus: HybridMedicalValidationStatus;
    learningType: HybridMedicalLearningType;
    safetyFlags: string[];
    citations: MedicalCitation[];
    query: string;
    teacherSummary: string;
  }): boolean {
    if (input.validationStatus === 'rejected') return false;
    if (input.role !== MedicalAssistantRole.DOCTOR) return false;
    if (input.teacherSummary.trim().length === 0) return false;
    if (input.safetyFlags.some((flag) => flag.startsWith('phi_'))) return false;
    if (this.looksDiagnosticOrPatientSpecific(input.query)) return false;
    return input.learningType === 'official_reference'
      || input.learningType === 'safety_correction'
      || input.validationStatus === 'doctor_validated'
      || (input.validationStatus === 'auto_safe' && input.citations.length > 0);
  }

  private isAllowedForReuse(input: {
    validationStatus: HybridMedicalValidationStatus;
    learningType: HybridMedicalLearningType;
    reuseScope: HybridMedicalReuseScope;
    teacherSummary: string;
  }): boolean {
    if (input.validationStatus === 'rejected') return false;
    if (input.reuseScope === 'none') return false;
    if (input.teacherSummary.trim().length === 0) return false;
    return input.learningType !== 'rejected_unsafe';
  }

  private looksDiagnosticOrPatientSpecific(query: string): boolean {
    return /\b(diagnost|dosis|prescrib|mi paciente|paciente de|tratamiento definitivo|confirmar)\b/i.test(query);
  }

  private resolveMedicalDomain(concepts: string[], modality: 'text' | 'image' | 'multimodal'): string {
    if (modality !== 'text') {
      return modality === 'image' ? 'medical_imaging' : 'multimodal_clinical_support';
    }
    if (concepts.some((concept) => ['shock', 'sepsis', 'ventilacion', 'uti'].includes(concept))) {
      return 'critical_care';
    }
    if (concepts.some((concept) => ['cardio', 'toracico', 'infarto'].includes(concept))) {
      return 'cardiology';
    }
    return 'general_clinical_support';
  }

  private normalizeLoadedRecord(raw: Record<string, unknown>): MedicalChatLearningRecord | null {
    if (typeof raw.id !== 'string') {
      return null;
    }

    if (raw.rawTextStored === false && typeof raw.source === 'string' && typeof raw.sessionId === 'string') {
      return raw as unknown as MedicalChatLearningRecord;
    }

    const recordedAt = typeof raw.recordedAt === 'string' ? raw.recordedAt : new Date().toISOString();
    const explicitTeaching = raw.explicitTeaching as { hash?: string; sanitizedText?: string } | undefined;
    const concepts = Array.isArray(raw.concepts)
      ? raw.concepts.filter((value): value is string => typeof value === 'string')
      : [];
    const officialSourceUrls = Array.isArray(raw.officialSourceUrls)
      ? raw.officialSourceUrls.filter((value): value is string => typeof value === 'string')
      : [];
    const citations = officialSourceUrls.map((url) => ({ source: 'legacy', url, title: url, date: 'legacy' }));
    const promptSummary = explicitTeaching?.sanitizedText
      || (concepts.length > 0 ? `Consulta resumida: ${concepts.join(', ')}` : 'Registro legado importado');

    return {
      id: raw.id,
      timestamp: recordedAt,
      recordedAt,
      source: explicitTeaching?.sanitizedText ? 'doctor_teaching' : 'system_correction',
      tenantId: 'legacy-session',
      doctorId: typeof raw.role === 'string' ? String(raw.role).toLowerCase() : 'legacy',
      sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : 'legacy-session',
      medicalDomain: 'legacy_import',
      learningType: explicitTeaching?.sanitizedText ? 'doctor_preference' : 'safety_correction',
      sanitizedPromptSummary: promptSummary.slice(0, MedicalChatLearningService.MAX_SUMMARY_LENGTH),
      sanitizedTeacherAnswerSummary: '',
      extractedClinicalConcepts: concepts,
      extractedProfessionalPhrases: [],
      officialCitations: citations,
      safetyFlags: ['legacy_import'],
      confidence: typeof raw.decision === 'object' && raw.decision !== null && typeof (raw.decision as { confidence?: unknown }).confidence === 'number'
        ? ((raw.decision as { confidence: number }).confidence)
        : 0.5,
      allowedForReuse: Boolean(explicitTeaching?.sanitizedText),
      allowedForTraining: false,
      validationStatus: explicitTeaching?.sanitizedText ? 'doctor_validated' : 'pending',
      reuseScope: explicitTeaching?.sanitizedText ? 'same_doctor' : 'none',
      rawTextStored: false,
      metadata: { legacy: true },
      role: typeof raw.role === 'string' ? raw.role as MedicalAssistantRole | 'INFERRED' : 'INFERRED',
      mode: typeof raw.mode === 'string' ? raw.mode as ClinicalAssistantMode : 'clinical_support',
      country: typeof raw.country === 'string' ? raw.country : 'AR',
      modality: raw.modality === 'image' || raw.modality === 'multimodal' ? raw.modality : 'text',
      concepts,
      citationCount: citations.length,
      officialSourceUrls,
      decision: typeof raw.decision === 'object' && raw.decision !== null
        ? raw.decision as MedicalChatControlledDecision
        : {
            action: 'safe_fallback',
            confidence: 0.5,
            allowed: true,
            execution: 'dry_run',
            reason: 'legacy_import',
          },
      outcome: raw.outcome === 'blocked' || raw.outcome === 'fallback' ? raw.outcome : 'simulated',
      queryHash: typeof raw.queryHash === 'string' ? raw.queryHash : this.hash(promptSummary),
      ...(explicitTeaching?.hash && explicitTeaching.sanitizedText
        ? { explicitTeaching: { hash: explicitTeaching.hash, sanitizedText: explicitTeaching.sanitizedText } }
        : {}),
    };
  }

  private dedupeCitations(citations: MedicalCitation[]): MedicalCitation[] {
    const seen = new Set<string>();
    return citations.filter((citation) => {
      const key = `${citation.source}|${citation.url}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private dedupeClinicalTriggers(triggers: ClinicalTrigger[]): ClinicalTrigger[] {
    const seen = new Set<string>();
    return triggers.filter((trigger) => {
      const key = `${trigger.category}|${trigger.trigger_key}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private readEnvBool(name: string, fallback: boolean): boolean {
    const value = process.env[name]?.trim().toLowerCase();
    if (!value) return fallback;
    if (['1', 'true', 'yes', 'on'].includes(value)) return true;
    if (['0', 'false', 'no', 'off'].includes(value)) return false;
    return fallback;
  }

  private readMinSeverityEnv(name: string, fallback: ClinicalTriggerSeverityHint): ClinicalTriggerSeverityHint {
    const value = process.env[name]?.trim().toLowerCase();
    if (value === 'low' || value === 'medium' || value === 'high') {
      return value;
    }
    return fallback;
  }

  private isSeverityAtLeast(value: ClinicalTriggerSeverityHint, threshold: ClinicalTriggerSeverityHint): boolean {
    const rank: Record<ClinicalTriggerSeverityHint, number> = { low: 1, medium: 2, high: 3 };
    return rank[value] >= rank[threshold];
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private resolveStoragePath(): string {
    const configured = process.env.MEDICAL_CHAT_LEARNING_PATH?.trim();
    if (configured) return configured;
    return join(process.cwd(), 'data', 'medical-chat-learning.jsonl');
  }
}
