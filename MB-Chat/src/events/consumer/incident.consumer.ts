import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';
import { BrainService } from '../../brain/brain.service';
import { IncidentPayload } from '../../common/types/brain.types';
import { EventProducer } from '../producer/event.producer';
import { EventEnvelope, RabbitBusService } from '../rabbit/rabbit-bus.service';

@Injectable()
export class IncidentConsumer implements OnModuleInit {
  private readonly logger = new Logger(IncidentConsumer.name);
  private readonly processed = new Map<string, number>();
  private readonly maxRetries = Number(process.env.EVENT_MAX_RETRIES ?? '3');
  private readonly idempotencyTtlMs = Number(process.env.EVENT_IDEMPOTENCY_TTL_MS ?? '3600000');

  constructor(
    private readonly bus: RabbitBusService,
    private readonly brainService: BrainService,
    private readonly producer: EventProducer,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.bus.consume(this.bus.getIncidentQueue(), async (message) => {
      await this.handle(message);
    });
    this.logger.log('[IncidentConsumer] Subscribed to incident queue');
  }

  private async handle(message: ConsumeMessage): Promise<void> {
    try {
      const envelope = this.parseMessage(message);
      this.cleanupProcessed();

      if (this.isProcessed(envelope.event_id)) {
        this.logger.debug(`[IncidentConsumer] Duplicate skipped event_id=${envelope.event_id}`);
        await this.bus.ack(message);
        return;
      }

      const eventPayload = envelope.payload as { incident?: IncidentPayload };
      const incident = eventPayload.incident;
      if (!incident) {
        throw new Error('incident_payload_missing');
      }
      const result = await this.brainService.processIncident(incident);

      await this.producer.publish(
        'decision.made',
        {
          incident_id: incident.id,
          decision: result,
          causal_event_id: envelope.event_id,
        },
        {
          traceId: envelope.trace_id,
        },
      );

      this.markProcessed(envelope.event_id);
      await this.bus.ack(message);
    } catch (error) {
      await this.handleFailure(message, error);
    }
  }

  private async handleFailure(message: ConsumeMessage, error: unknown): Promise<void> {
    const msg = error instanceof Error ? error.message : String(error);
    const envelope = this.tryParseMessage(message);
    const retryCount = envelope?.retry_count ?? this.getRetryCountFromHeader(message);

    this.logger.error(
      `[IncidentConsumer] Processing failed retry=${retryCount}/${this.maxRetries} error=${msg}`,
    );

    if (envelope && retryCount < this.maxRetries) {
      await this.producer.publish(
        'incident.retry',
        envelope.payload as Record<string, unknown>,
        {
          traceId: envelope.trace_id,
          eventId: envelope.event_id,
          retryCount: retryCount + 1,
        },
      );
    } else if (envelope) {
      await this.producer.publish(
        'incident.dlq',
        {
          original_event: envelope,
          error: msg,
        },
        {
          traceId: envelope.trace_id,
        },
      );
    }

    await this.bus.ack(message);
  }

  private parseMessage(message: ConsumeMessage): EventEnvelope {
    const raw = message.content.toString('utf-8');
    const parsed = JSON.parse(raw) as EventEnvelope;
    return {
      ...parsed,
      retry_count: Number(parsed.retry_count ?? this.getRetryCountFromHeader(message) ?? 0),
    };
  }

  private tryParseMessage(message: ConsumeMessage): EventEnvelope | null {
    try {
      return this.parseMessage(message);
    } catch {
      return null;
    }
  }

  private getRetryCountFromHeader(message: ConsumeMessage): number {
    const value = message.properties.headers?.retry_count;
    return typeof value === 'number' ? value : Number(value ?? 0);
  }

  private isProcessed(eventId: string): boolean {
    const value = this.processed.get(eventId);
    return typeof value === 'number' && value > Date.now();
  }

  private markProcessed(eventId: string): void {
    this.processed.set(eventId, Date.now() + this.idempotencyTtlMs);
  }

  private cleanupProcessed(): void {
    const now = Date.now();
    for (const [eventId, expiresAt] of this.processed.entries()) {
      if (expiresAt <= now) this.processed.delete(eventId);
    }
  }
}
