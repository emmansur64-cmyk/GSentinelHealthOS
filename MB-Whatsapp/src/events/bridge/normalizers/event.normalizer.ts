import { Injectable } from '@nestjs/common';

export type NormalizedEventType = 'booking.conflict' | 'booking.failed' | 'api.error' | 'system.error';

export interface NormalizedBridgeEvent {
  type: NormalizedEventType;
  source: 'booking-service';
  timestamp: string;
  data: Record<string, unknown>;
  logs: string[];
  metrics: Record<string, unknown>;
}

@Injectable()
export class EventNormalizer {
  normalize(raw: unknown): NormalizedBridgeEvent {
    const input = this.asObject(raw);

    return {
      type: this.normalizeType(input),
      source: 'booking-service',
      timestamp: this.normalizeTimestamp(input.timestamp),
      data: this.normalizeData(input),
      logs: this.normalizeLogs(input),
      metrics: this.normalizeMetrics(input),
    };
  }

  private asObject(value: unknown): Record<string, unknown> {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }

  private normalizeType(input: Record<string, unknown>): NormalizedEventType {
    const rawType = String(input.type ?? input.eventType ?? input.kind ?? '').toLowerCase();

    if (rawType.includes('booking') && (rawType.includes('conflict') || rawType.includes('overbook'))) {
      return 'booking.conflict';
    }

    if (rawType.includes('booking') && (rawType.includes('failed') || rawType.includes('failure'))) {
      return 'booking.failed';
    }

    if (rawType.includes('api')) {
      return 'api.error';
    }

    if (rawType.includes('system')) {
      return 'system.error';
    }

    if (rawType.includes('timeout') || rawType.includes('postgres') || rawType.includes('database')) {
      return 'system.error';
    }

    return 'api.error';
  }

  private normalizeTimestamp(value: unknown): string {
    if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
      return new Date(value).toISOString();
    }

    return new Date().toISOString();
  }

  private normalizeData(input: Record<string, unknown>): Record<string, unknown> {
    const candidate = input.data ?? input.payload ?? input.body;
    if (typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate)) {
      return { ...(candidate as Record<string, unknown>) };
    }

    return {};
  }

  private normalizeLogs(input: Record<string, unknown>): string[] {
    const candidate = input.logs ?? input.logLines ?? input.messages;
    if (!Array.isArray(candidate)) {
      return [];
    }

    return candidate.filter((item) => typeof item === 'string').map((item) => item as string);
  }

  private normalizeMetrics(input: Record<string, unknown>): Record<string, unknown> {
    const candidate = input.metrics ?? input.stats;
    if (typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate)) {
      return { ...(candidate as Record<string, unknown>) };
    }

    return {};
  }
}
