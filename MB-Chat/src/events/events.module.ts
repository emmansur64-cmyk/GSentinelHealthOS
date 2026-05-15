import { Module, forwardRef } from '@nestjs/common';
import { IncidentConsumer } from './consumer/incident.consumer';
import { EventProducer } from './producer/event.producer';
import { RabbitBusService } from './rabbit/rabbit-bus.service';
import { BrainModule } from '../brain/brain.module';

@Module({
  imports: [forwardRef(() => BrainModule)],
  providers: [RabbitBusService, EventProducer, IncidentConsumer],
  exports: [EventProducer],
})
export class EventsModule {}
