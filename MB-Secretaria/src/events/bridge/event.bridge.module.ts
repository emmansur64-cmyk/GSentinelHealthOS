import { Module } from '@nestjs/common';
import { BrainModule } from '../../brain/brain.module';
import { KafkaConsumer } from './consumers/kafka.consumer';
import { RabbitConsumer } from './consumers/rabbit.consumer';
import { EventBridgeService } from './event.bridge.service';
import { EventNormalizer } from './normalizers/event.normalizer';

@Module({
  imports: [BrainModule],
  providers: [EventBridgeService, EventNormalizer, KafkaConsumer, RabbitConsumer],
  exports: [EventBridgeService, KafkaConsumer, RabbitConsumer],
})
export class EventBridgeModule {}
