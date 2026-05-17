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

export interface MedicalChatLearningRecord {
  id: string;
  recordedAt: string;
  queryHash: string;
  role: MedicalAssistantRole | 'INFERRED';
  mode: ClinicalAssistantMode;
  country: string;
  modality: 'text' | 'image' | 'multimodal';
  concepts: string[];
  citationCount: number;
  officialSourceUrls: string[];
  decision: MedicalChatControlledDecision;
  outcome: 'simulated' | 'blocked' | 'fallback';
  sessionId?: string;
  sessionTurn?: {
    role: 'user' | 'assistant';
    text: string;
  };
  explicitTeaching?: {
    hash: string;
    sanitizedText: string;
  };
}

@Injectable()
export class MedicalChatLearningService implements OnModuleInit {
  private static readonly MAX_MEMORY = 500;

  private readonly logger = new Logger(MedicalChatLearningService.name);
  private readonly records: MedicalChatLearningRecord[] = [];
  private readonly storagePath = this.resolveStoragePath();

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

  record(input: {
    request: MedicalAssistantRequest;
    query: string;
    mode: ClinicalAssistantMode;
    modality: 'text' | 'image' | 'multimodal';
    citations: MedicalCitation[];
    decision: MedicalChatControlledDecision;
    outcome: MedicalChatLearningRecord['outcome'];
    sessionId?: string;
    sessionTurn?: MedicalChatLearningRecord['sessionTurn'];
  }): MedicalChatLearningRecord {
    const role = input.request.role ?? 'INFERRED';
    const country = input.request.country ?? 'AR';
    const explicitTeaching = this.extractExplicitTeaching(input.query);
    const record: MedicalChatLearningRecord = {
      id: `medlearn-${Date.now()}-${this.hash(`${input.query}|${Math.random()}`).slice(0, 8)}`,
      recordedAt: new Date().toISOString(),
      queryHash: this.hash(input.query),
      role,
      mode: input.mode,
      country,
      modality: input.modality,
      concepts: this.extractConcepts(input.query),
      citationCount: input.citations.length,
      officialSourceUrls: input.citations.map((citation) => citation.url).slice(0, 12),
      decision: input.decision,
      outcome: input.outcome,
      ...(input.sessionId ? { sessionId: input.sessionId.slice(0, 128) } : {}),
      ...(input.sessionTurn ? { sessionTurn: { role: input.sessionTurn.role, text: input.sessionTurn.text.slice(0, 1200) } } : {}),
      ...(explicitTeaching ? { explicitTeaching } : {}),
    };

    this.records.push(record);
    if (this.records.length > MedicalChatLearningService.MAX_MEMORY) {
      this.records.shift();
    }

    this.persist(record);
    return record;
  }

  getRecent(limit = 20): MedicalChatLearningRecord[] {
    return this.records.slice(-Math.max(1, limit));
  }

  getSessionMemorySummary(sessionId: string | undefined, limit = 8): string | undefined {
    const id = (sessionId ?? '').trim();
    const pool = id
      ? this.records.filter((record) => record.sessionId === id)
      : this.records;

    const turns = pool
      .filter((record) => record.sessionTurn && record.sessionTurn.text.trim().length > 0)
      .slice(-Math.max(1, limit))
      .map((record) => `${record.sessionTurn?.role === 'assistant' ? 'Asistente' : 'Usuario'}: ${record.sessionTurn?.text ?? ''}`);

    const teachings = pool
      .filter((record) => record.explicitTeaching?.sanitizedText)
      .slice(-Math.max(1, Math.floor(limit / 2)))
      .map((record) => `Memoria solicitada: ${record.explicitTeaching?.sanitizedText ?? ''}`);

    const combined = [...teachings, ...turns];
    if (combined.length === 0) return undefined;
    return combined.join('\n').slice(0, 3000);
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
          this.records.push(JSON.parse(row) as MedicalChatLearningRecord);
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

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private resolveStoragePath(): string {
    const configured = process.env.MEDICAL_CHAT_LEARNING_PATH?.trim();
    if (configured) return configured;
    const persistentVolumePath = '/data/uploads/mb-chat-learning/medical-chat-learning.jsonl';
    return persistentVolumePath || join(process.cwd(), 'data', 'medical-chat-learning.jsonl');
  }
}
