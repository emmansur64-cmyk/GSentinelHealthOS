import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventBridgeService } from '../event.bridge.service';

@Injectable()
export class KafkaConsumer implements OnModuleInit {
  private readonly logger = new Logger(KafkaConsumer.name);

  constructor(private readonly bridge: EventBridgeService) {}

  onModuleInit(): void {
    this.logger.log('Kafka consumer initialized in bridge layer');
  }

  async consume(rawEvent: unknown): Promise<void> {
    await this.bridge.ingest(rawEvent, 'kafka');
  }
}
