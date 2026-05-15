import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventBridgeService } from '../event.bridge.service';

@Injectable()
export class RabbitConsumer implements OnModuleInit {
  private readonly logger = new Logger(RabbitConsumer.name);

  constructor(private readonly bridge: EventBridgeService) {}

  onModuleInit(): void {
    this.logger.log('RabbitMQ consumer initialized in bridge layer');
  }

  async consume(rawEvent: unknown): Promise<void> {
    await this.bridge.ingest(rawEvent, 'rabbit');
  }
}
