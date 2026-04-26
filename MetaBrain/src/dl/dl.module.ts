import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { AnomalyPredictorService } from './anomaly-predictor.service';
import { DlModelLoader } from './model.loader';
import { SequenceBuilderService } from './sequence-builder';

@Module({
  imports: [PersistenceModule],
  providers: [DlModelLoader, SequenceBuilderService, AnomalyPredictorService],
  exports: [AnomalyPredictorService],
})
export class DlModule {}
