import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import aiConfig from './config/ai.config';
import envConfig from './config/env.config';
import { ActionModule } from './action-engine/action.module';
import { AiModule } from './ai/ai.module';
import { AuditModule } from './audit/audit.module';
import { BrainModule } from './brain/brain.module';
import { GuardModule } from './guard/guard.module';
import { MemoryModule } from './memory/memory.module';
import { EventsModule } from './events/events.module';
import { EventBridgeModule } from './events/bridge/event.bridge.module';
import { IngressModule } from './ingress/ingress.module';
import { IntegrationModule } from './integration/integration.module';
import { MlModule } from './ml/ml.module';
import { MlServiceModule } from './ml-service/ml-service.module';
import { PersistenceModule } from './persistence/persistence.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { MedicalAssistantModule } from './medical-assistant/medical-assistant.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [envConfig, aiConfig],
    }),
    ScheduleModule.forRoot(),
    PersistenceModule,
    AiModule,
    GuardModule,
    ActionModule,
    AuditModule,
    MemoryModule,
    EventsModule,
    EventBridgeModule,
    BrainModule,
    IngressModule,
    IntegrationModule,
    MlModule,
    MlServiceModule,
    KnowledgeModule,
    MedicalAssistantModule,
  ],
})
export class AppModule {}
