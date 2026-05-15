import { Injectable, Logger } from '@nestjs/common';
import { IncidentStatus, GatedExecutionResult } from '../common/types/brain.types';
import type { MetaBrainEvent } from './event.mapper.js';

export interface MetaBrainResponse {
  status: IncidentStatus;
  action: string | null;
  reason: string;
  execution: GatedExecutionResult | null;
  meta?: Record<string, unknown>;
}

const FALLBACK_RESPONSE: MetaBrainResponse = {
  status: 'FALLBACK',
  action: null,
  reason: 'metabrain_unavailable',
  execution: null,
};

function isValidMetaBrainResponse(value: unknown): value is MetaBrainResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const validStatuses: IncidentStatus[] = [
    'SUCCESS',
    'BLOCKED',
    'FALLBACK',
    'EXECUTED',
    'SIMULATED',
  ];
  return (
    typeof v['status'] === 'string' &&
    validStatuses.includes(v['status'] as IncidentStatus) &&
    (v['action'] === null || typeof v['action'] === 'string') &&
    typeof v['reason'] === 'string'
  );
}

@Injectable()
export class MetaBrainClient {
  private readonly logger = new Logger(MetaBrainClient.name);

  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;

  constructor() {
    this.baseUrl = process.env.METABRAIN_URL ?? 'http://localhost:3001';
    this.timeoutMs = 3_000;
    this.maxAttempts = 2; // 1 initial + 1 retry
  }

  async sendIncident(event: MetaBrainEvent): Promise<MetaBrainResponse> {
    const apiKey = process.env.METABRAIN_API_KEYS?.split(',')[0]?.trim()
      ?? process.env.METABRAIN_API_KEY;

    if (!apiKey) {
      this.logger.error('[MetaBrainClient] No API key configured — returning fallback');
      return FALLBACK_RESPONSE;
    }

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(`${this.baseUrl}/incident`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(event),
          signal: controller.signal,
        }).finally(() => clearTimeout(timer));

        if (!response.ok) {
          this.logger.warn(
            `[MetaBrainClient] HTTP ${response.status} on attempt ${attempt}/${this.maxAttempts}`,
          );
          if (attempt < this.maxAttempts) continue;
          return FALLBACK_RESPONSE;
        }

        const raw: unknown = await response.json();

        if (!isValidMetaBrainResponse(raw)) {
          this.logger.error(
            `[MetaBrainClient] Invalid response schema on attempt ${attempt} — returning fallback`,
          );
          return FALLBACK_RESPONSE;
        }

        return raw;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isAbort = err instanceof Error && err.name === 'AbortError';
        this.logger.warn(
          `[MetaBrainClient] ${isAbort ? 'Timeout' : 'Error'} on attempt ${attempt}/${this.maxAttempts}: ${msg}`,
        );
        if (attempt < this.maxAttempts) continue;
      }
    }

    return FALLBACK_RESPONSE;
  }
}
