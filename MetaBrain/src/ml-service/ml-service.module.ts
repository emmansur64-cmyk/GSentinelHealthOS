import { Module } from '@nestjs/common';
import { MlServiceController } from './ml-service.controller';
import { MlServiceService } from './ml-service.service';
import { ModelRegistryService } from './model-registry.service';
import { MetricsService } from './metrics.service';
import { ModelMonitorService } from './model-monitor.service';
import { MlCoreModule } from '../ml-core/ml-core.module';
import { PersistenceModule } from '../persistence/persistence.module';

@Module({
  imports: [MlCoreModule, PersistenceModule],
  controllers: [MlServiceController],
  providers: [MlServiceService, ModelRegistryService, MetricsService, ModelMonitorService],
  exports: [MlServiceService, MetricsService, ModelMonitorService],
})
export class MlServiceModule {}