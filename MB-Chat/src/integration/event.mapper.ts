import { randomUUID } from 'node:crypto';

export type MetaBrainEventType =
  | 'system.error'
  | 'booking.conflict'
  | 'api.error'
  | 'schedule.error'
  | 'data.error'
  | 'unknown';

export interface MetaBrainEventMetadata {
  tenantId: string;
  logs: string[];
  data: Record<string, unknown>;
}

export interface MetaBrainEvent {
  id: string;
  type: MetaBrainEventType;
  source: string;
  timestamp: string;
  message: string;
  metadata: MetaBrainEventMetadata;
}

/**
 * Raw event contract accepted from GSentinelHealthOS. All fields are optional
 * so the mapper can safely normalise arbitrary upstream shapes.
 */
export interface RawGSentinelEvent {
  id?: string;
  type?: string;
  source?: string;
  timestamp?: string | Date;
  message?: string;
  error?: string | Error;
  tenantId?: string;
  logs?: unknown[];
  data?: Record<string, unknown>;
  metadata?: {
    tenantId?: string;
    logs?: unknown[];
    data?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

const EVENT_TYPE_MAP: Record<string, MetaBrainEventType> = {
  'system.error': 'system.error',
  'booking.conflict': 'booking.conflict',
  'booking.error': 'booking.conflict',
  'api.error': 'api.error',
  'api.failure': 'api.error',
  'schedule.error': 'schedule.error',
  'schedule.conflict': 'schedule.error',
  'data.error': 'data.error',
  'data.corruption': 'data.error',
};

function resolveEventType(raw: string | undefined): MetaBrainEventType {
  if (!raw) return 'unknown';
  const lower = raw.toLowerCase().trim();
  return EVENT_TYPE_MAP[lower] ?? 'system.error';
}

function extractMessage(event: RawGSentinelEvent): string {
  if (typeof event.message === 'string' && event.message.trim()) {
    return event.message.trim();
  }
  if (event.error instanceof Error) return event.error.message;
  if (typeof event.error === 'string' && event.error.trim()) return event.error.trim();
  if (event.metadata?.logs?.[0] && typeof event.metadata.logs[0] === 'string') {
    return event.metadata.logs[0];
  }
  return event.type ?? 'incident';
}

function extractLogs(event: RawGSentinelEvent): string[] {
  const rawLogs = event.metadata?.logs ?? event.logs ?? [];
  if (!Array.isArray(rawLogs)) return [];
  return rawLogs.filter((l): l is string => typeof l === 'string');
}

function resolveTimestamp(event: RawGSentinelEvent): string {
  if (!event.timestamp) return new Date().toISOString();
  if (event.timestamp instanceof Date) return event.timestamp.toISOString();
  const parsed = Date.parse(event.timestamp);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

export function mapToMetaBrainEvent(raw: RawGSentinelEvent): MetaBrainEvent {
  const tenantId =
    (raw.tenantId ??
      raw.metadata?.tenantId ??
      '') as string;

  const data: Record<string, unknown> =
    raw.metadata?.data ?? raw.data ?? {};

  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : randomUUID(),
    type: resolveEventType(raw.type),
    source:
      typeof raw.source === 'string' && raw.source.trim()
        ? raw.source.trim()
        : 'gsentinelhealthos',
    timestamp: resolveTimestamp(raw),
    message: extractMessage(raw),
    metadata: {
      tenantId: typeof tenantId === 'string' ? tenantId : '',
      logs: extractLogs(raw),
      data,
    },
  };
}
