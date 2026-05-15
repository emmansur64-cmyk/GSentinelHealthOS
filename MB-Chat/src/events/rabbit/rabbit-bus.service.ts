import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import amqp, { Channel, ChannelModel, ConsumeMessage } from 'amqplib';

export interface EventEnvelope<T = Record<string, unknown>> {
  event_id: string;
  trace_id: string;
  topic: string;
  timestamp: string;
  retry_count: number;
  payload: T;
}

@Injectable()
export class RabbitBusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitBusService.name);

  private readonly url = process.env.RABBITMQ_URL ?? 'amqp://localhost:5672';
  private readonly exchange = process.env.RABBITMQ_EXCHANGE ?? 'metabrain.events';
  private readonly incidentQueue = process.env.RABBITMQ_INCIDENT_QUEUE ?? 'metabrain.incident.main';
  private readonly retryQueue = process.env.RABBITMQ_RETRY_QUEUE ?? 'metabrain.incident.retry';
  private readonly deadQueue = process.env.RABBITMQ_DEAD_QUEUE ?? 'metabrain.incident.dlq';
  private readonly retryTtlMs = Number(process.env.RABBITMQ_RETRY_TTL_MS ?? '5000');

  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      // no-op
    }
    this.channel = null;
    this.connection = null;
  }

  async publish(envelope: EventEnvelope, routingKey: string): Promise<void> {
    const channel = await this.ensureChannel();
    const payload = Buffer.from(JSON.stringify(envelope));

    channel.publish(this.exchange, routingKey, payload, {
      persistent: true,
      contentType: 'application/json',
      messageId: envelope.event_id,
      timestamp: Date.now(),
      headers: {
        trace_id: envelope.trace_id,
        retry_count: envelope.retry_count,
        topic: envelope.topic,
      },
    });
  }

  async consume(
    queue: string,
    handler: (message: ConsumeMessage) => Promise<void>,
  ): Promise<void> {
    const channel = await this.ensureChannel();
    await channel.consume(queue, async (message) => {
      if (!message) return;
      await handler(message);
    });
  }

  async ack(message: ConsumeMessage): Promise<void> {
    const channel = await this.ensureChannel();
    channel.ack(message);
  }

  async setupTopology(): Promise<void> {
    const channel = await this.ensureChannel();
    await channel.assertExchange(this.exchange, 'topic', { durable: true });

    await channel.assertQueue(this.incidentQueue, { durable: true });
    await channel.bindQueue(this.incidentQueue, this.exchange, 'incident.received');

    await channel.assertQueue(this.retryQueue, {
      durable: true,
      deadLetterExchange: this.exchange,
      deadLetterRoutingKey: 'incident.received',
      messageTtl: this.retryTtlMs,
    });
    await channel.bindQueue(this.retryQueue, this.exchange, 'incident.retry');

    await channel.assertQueue(this.deadQueue, { durable: true });
    await channel.bindQueue(this.deadQueue, this.exchange, 'incident.dlq');

    await channel.assertQueue('metabrain.decision.events', { durable: true });
    await channel.bindQueue('metabrain.decision.events', this.exchange, 'decision.made');

    await channel.prefetch(10);
  }

  getIncidentQueue(): string {
    return this.incidentQueue;
  }

  private async ensureChannel(): Promise<Channel> {
    if (this.channel) return this.channel;
    await this.connect();
    if (!this.channel) {
      throw new Error('RabbitMQ channel unavailable after connect');
    }
    return this.channel;
  }

  private async connect(): Promise<void> {
    try {
      if (this.connection && this.channel) return;

      const connection = await amqp.connect(this.url);
      const channel = await connection.createChannel();

      this.connection = connection;
      this.channel = channel;
      await this.setupTopology();

      connection.on('close', () => {
        this.logger.warn('[RabbitMQ] Connection closed, scheduling reconnect');
        this.channel = null;
        this.connection = null;
        this.scheduleReconnect();
      });

      connection.on('error', (error) => {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`[RabbitMQ] Connection error: ${msg}`);
      });

      this.logger.log(`[RabbitMQ] Connected url=${this.url} exchange=${this.exchange}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[RabbitMQ] Connect failed: ${msg}`);
      this.channel = null;
      this.connection = null;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      await this.connect();
    }, 3000);
  }
}
