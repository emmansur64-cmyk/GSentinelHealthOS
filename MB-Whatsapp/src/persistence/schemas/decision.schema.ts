import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BrainDecision, CommandId } from '../../common/types/brain.types';

export type DecisionDocument = HydratedDocument<Decision>;

@Schema({ timestamps: true, collection: 'decisions' })
export class Decision {
  @Prop({ required: true })
  incidentId!: string;

  @Prop({ required: true })
  source!: string;

  @Prop({ required: true })
  action!: CommandId;

  @Prop({ required: true, type: String, enum: ['booking', 'schedule', 'error'] })
  strategy!: BrainDecision['strategy'];

  @Prop({ required: true })
  confidence!: number;

  @Prop({ required: true })
  reason!: string;

  @Prop({ required: true })
  createdAt!: string;
}

export const DecisionSchema = SchemaFactory.createForClass(Decision);
DecisionSchema.index({ incidentId: 1, createdAt: -1 });
DecisionSchema.index({ action: 1, createdAt: -1 });
