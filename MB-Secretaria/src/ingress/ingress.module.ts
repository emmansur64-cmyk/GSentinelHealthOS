import { Module } from '@nestjs/common';
import { BrainModule } from '../brain/brain.module';
import { ApiKeyGuard } from './guards/api-key.guard';
import { IncidentController } from './incident.controller';

@Module({
  imports: [BrainModule],
  controllers: [IncidentController],
  providers: [ApiKeyGuard],
})
export class IngressModule {}
