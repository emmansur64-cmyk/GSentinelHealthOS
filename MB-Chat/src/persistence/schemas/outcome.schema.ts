import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { IncidentPayload, MlPredictionTrace } from '../../common/types/brain.types';

export type OutcomeDocument = HydratedDocument<Outcome>;

@Schema({ timestamps: true, collection: 'outcomes' })
export class Outcome {
  @Prop({ required: false })
  incidentId?: string;

  @Prop({ required: true })
  action!: string;

  @Prop({ required: true, enum: ['success', 'failure', 'blocked', 'simulated'] })
  outcome!: 'success' | 'failure' | 'blocked' | 'simulated';

  @Prop({ required: false, type: Object })
  input?: IncidentPayload;

  @Prop({ required: false, type: Object })
  prediction?: MlPredictionTrace;

  @Prop({
    required: false,
    type: {
      executed: Boolean,
      simulated: Boolean,
      reason: String,
      output: String,
      error: String,
    },
  })
  realResult?: {
    executed: boolean;
    simulated: boolean;
    reason: string;
    output: string;
    error: string | null;
  };

  @Prop({ required: true })
  recordedAt!: string;
}

export const OutcomeSchema = SchemaFactory.createForClass(Outcome);
OutcomeSchema.index({ recordedAt: -1 });
OutcomeSchema.index({ incidentId: 1, recordedAt: -1 });
