import { Module } from '@nestjs/common';
import { FeatureBuilder } from './feature-builder';
import { MlCoreModelLoader } from './model.loader';
import { MlCorePredictorService } from './predictor.service';

@Module({
  providers: [FeatureBuilder, MlCoreModelLoader, MlCorePredictorService],
  exports: [FeatureBuilder, MlCoreModelLoader, MlCorePredictorService],
})
export class MlCoreModule {}
