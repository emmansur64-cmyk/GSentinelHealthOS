import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BrainDecision, ExecutionResult, IncidentPayload, MlPredictionTrace } from '../../common/types/brain.types';

export type IncidentDocument = HydratedDocument<Incident>;

@Schema({ timestamps: true, collection: 'incidents' })
export class Incident {
  @Prop({ required: true })
  incidentId!: string;

  @Prop({ required: true, type: Object })
  incident!: IncidentPayload;

  @Prop({ required: true, type: Object })
  decision!: BrainDecision;

  @Prop({ required: true, type: Object })
  result!: ExecutionResult;

  @Prop({ required: false, type: Object })
  prediction?: MlPredictionTrace;

  @Prop({ required: false })
  realOutcome?: 'success' | 'failure' | 'blocked' | 'simulated';

  @Prop({ required: true })
  storedAt!: string;
}

export const IncidentSchema = SchemaFactory.createForClass(Incident);
IncidentSchema.index({ incidentId: 1, storedAt: -1 });
IncidentSchema.index({ storedAt: -1 });
