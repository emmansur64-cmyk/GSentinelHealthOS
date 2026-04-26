import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EventEnvelope, RabbitBusService } from '../rabbit/rabbit-bus.service';

interface PublishOptions {
  traceId?: string;
  eventId?: string;
  retryCount?: number;
}

@Injectable()
export class EventProducer {
  private readonly logger = new Logger(EventProducer.name);

  constructor(private readonly bus: RabbitBusService) {}

  private sanitize(payload: Record<string, unknown>): Record<string, unknown> {
    const clone: Record<string, unknown> = { ...payload };

    if ('token' in clone) {
      clone.token = '***';
    }

    if ('password' in clone) {
      clone.password = '***';
    }

    return clone;
  }

  async publish(
    topic: string,
    payload: Record<string, unknown>,
    options?: PublishOptions,
  ): Promise<{ event_id: string; trace_id: string }> {
    const traceId = options?.traceId ?? randomUUID();
    const eventId = options?.eventId ?? randomUUID();
    const retryCount = options?.retryCount ?? 0;

    const envelope: EventEnvelope = {
      event_id: eventId,
      trace_id: traceId,
      topic,
      timestamp: new Date().toISOString(),
      retry_count: retryCount,
      payload: this.sanitize(payload),
    };

    await this.bus.publish(envelope, topic);
    this.logger.debug(`Published event topic=${topic} trace_id=${traceId} event_id=${eventId}`);
    return { event_id: eventId, trace_id: traceId };
  }
}
