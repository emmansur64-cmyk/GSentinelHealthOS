import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { PersistenceService } from './persistence.service';
import { Incident, IncidentSchema } from './schemas/incident.schema';
import { Decision, DecisionSchema } from './schemas/decision.schema';
import { Outcome, OutcomeSchema } from './schemas/outcome.schema';
import { Feature, FeatureSchema } from './schemas/feature.schema';
import { AuditLog, AuditSchema } from './schemas/audit.schema';
import {
  OnlineTrainingBuffer,
  OnlineTrainingBufferSchema,
} from './schemas/online-training-buffer.schema';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('mongoUri') ?? 'mongodb://127.0.0.1:27017/metabrain',
        dbName: configService.get<string>('mongoDbName') ?? 'metabrain',
      }),
    }),
    MongooseModule.forFeature([
      { name: Incident.name, schema: IncidentSchema },
      { name: Decision.name, schema: DecisionSchema },
      { name: Outcome.name, schema: OutcomeSchema },
      { name: Feature.name, schema: FeatureSchema },
      { name: AuditLog.name, schema: AuditSchema },
      { name: OnlineTrainingBuffer.name, schema: OnlineTrainingBufferSchema },
    ]),
  ],
  providers: [PersistenceService],
  exports: [PersistenceService],
})
export class PersistenceModule {}
