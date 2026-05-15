import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { BrainService } from '../../brain/brain.service';
import { IncidentPayload } from '../../common/types/brain.types';
import { EventNormalizer, NormalizedBridgeEvent } from './normalizers/event.normalizer';

type IngressSource = 'kafka' | 'rabbit' | 'internal';

@Injectable()
export class EventBridgeService {
  private readonly logger = new Logger(EventBridgeService.name);

  private readonly internalEmitter = new EventEmitter();

  private readonly shadowMode = String(process.env.SHADOW_MODE ?? 'true').toLowerCase() !== 'false';

  constructor(
    private readonly normalizer: EventNormalizer,
    private readonly brainService: BrainService,
  ) {
    this.internalEmitter.on('bridge.event', (payload: unknown) => {
      void this.ingest(payload, 'internal');
    });
  }

  emitInternal(rawEvent: unknown): void {
    this.internalEmitter.emit('bridge.event', rawEvent);
  }

  async ingest(rawEvent: unknown, source: IngressSource): Promise<void> {
    try {
      const normalized = this.normalizer.normalize(rawEvent);
      const incident = this.toIncidentPayload(normalized, source);

      await this.brainService.processIncident(incident);
    } catch (error) {
      this.logger.error(`Bridge ingestion error (${source}): ${this.safeError(error)}`);
    }
  }

  private toIncidentPayload(event: NormalizedBridgeEvent, source: IngressSource): IncidentPayload {
    const generatedId = this.generateIncidentId(event, source);
    const rawMessage = this.extractMessage(event);

    return {
      id: generatedId,
      source: event.source,
      message: this.shadowMode ? 'noop' : rawMessage,
      timestamp: event.timestamp,
      metadata: {
        bridgeTransport: source,
        normalizedType: event.type,
        data: this.sanitizeRecord(event.data),
        logs: event.logs.map((entry) => this.sanitizeString(entry)),
        metrics: this.sanitizeRecord(event.metrics),
        shadowMode: this.shadowMode,
        originalMessage: rawMessage,
      },
    };
  }

  private extractMessage(event: NormalizedBridgeEvent): string {
    const dataMessage = event.data.message;
    if (typeof dataMessage === 'string' && dataMessage.trim().length > 0) {
      return this.sanitizeString(dataMessage);
    }

    if (event.logs.length > 0) {
      return this.sanitizeString(event.logs[0]);
    }

    return event.type;
  }

  private generateIncidentId(event: NormalizedBridgeEvent, source: IngressSource): string {
    const entropy = Math.random().toString(36).slice(2, 10);
    return `${source}-${event.type}-${Date.now()}-${entropy}`;
  }

  private sanitizeRecord(input: Record<string, unknown>): Record<string, unknown> {
    const output: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
      const lower = key.toLowerCase();
      if (lower.includes('token') || lower.includes('password') || lower.includes('secret')) {
        output[key] = '***';
        continue;
      }

      if (typeof value === 'string') {
        output[key] = this.sanitizeString(value);
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        output[key] = this.sanitizeRecord(value as Record<string, unknown>);
      } else {
        output[key] = value;
      }
    }

    return output;
  }

  private sanitizeString(value: string): string {
    return value
      .replace(/token\s*[:=]\s*[^\s,;]+/gi, 'token=***')
      .replace(/password\s*[:=]\s*[^\s,;]+/gi, 'password=***')
      .replace(/secret\s*[:=]\s*[^\s,;]+/gi, 'secret=***')
      .slice(0, 2000);
  }

  private safeError(error: unknown): string {
    if (error instanceof Error) {
      return this.sanitizeString(error.message);
    }

    return 'unknown_error';
  }
}
