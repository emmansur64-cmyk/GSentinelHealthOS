import {
  Body,
  Controller,
  PayloadTooLargeException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { IncidentResult, IncidentPayload } from '../common/types/brain.types';
import { EventProducer } from '../events/producer/event.producer';
import { ApiKeyGuard } from './guards/api-key.guard';

const MAX_PAYLOAD_BYTES = 50_000;

interface ExternalIncidentInput {
  id?: string;
  type?: string;
  source?: string;
  message?: string;
  timestamp?: string;
  data?: Record<string, unknown>;
  logs?: string[];
  metrics?: Record<string, unknown>;
}

@UseGuards(ApiKeyGuard)
@Controller('incident')
export class IncidentController {
  constructor(private readonly producer: EventProducer) {}

  @Post()
  async handle(
    @Body() payload: ExternalIncidentInput,
    @Req() request: { headers: Record<string, string | string[] | undefined> },
  ): Promise<IncidentResult> {
    // Reject oversized payloads early — prevents memory exhaustion / DoS
    if (JSON.stringify(payload).length > MAX_PAYLOAD_BYTES) {
      throw new PayloadTooLargeException('payload_too_large');
    }

    const traceHeader = request.headers['x-trace-id'];
    const traceId = typeof traceHeader === 'string' && traceHeader.trim().length > 0
      ? traceHeader.trim()
      : randomUUID();

    const normalized = this.normalizePayload(payload);
    const published = await this.producer.publish(
      'incident.received',
      {
        incident: normalized,
      },
      { traceId },
    );

    return {
      status: 'SUCCESS',
      action: '',
      reason: 'queued_for_processing',
      execution: null,
      meta: {
        incidentId: normalized.id,
        trace_id: published.trace_id,
        event_id: published.event_id,
      },
    };
  }

  private normalizePayload(payload: ExternalIncidentInput): IncidentPayload {
    // Guard against null/undefined payload
    const safe = payload ?? {};
    const logs = Array.isArray(safe.logs) ? safe.logs.filter((entry) => typeof entry === 'string') : [];
    const message = safe.message ?? logs[0] ?? safe.type ?? 'incident';

    return {
      id: safe.id ?? `incident-${Date.now()}`,
      source: safe.source ?? 'unknown',
      message,
      timestamp: safe.timestamp ?? new Date().toISOString(),
      metadata: {
        data: safe.data ?? {},
        logs,
        metrics: safe.metrics ?? {},
        originalType: safe.type ?? 'unknown',
      },
    };
  }
}
