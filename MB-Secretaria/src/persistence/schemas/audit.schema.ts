import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ActionType, BrainDecision, CommandId, ExecutionResult, MlPredictionTrace } from '../../common/types/brain.types';

export type AuditDocument = HydratedDocument<AuditLog>;

@Schema({ timestamps: true, collection: 'audits' })
export class AuditLog {
  @Prop({ required: true })
  incidentId!: string;

  @Prop({ required: true })
  source!: string;

  @Prop({ required: false, type: Object })
  decision?: BrainDecision;

  @Prop({ required: false, type: Object })
  result?: ExecutionResult;

  @Prop({ required: false, enum: ['SUCCESS', 'FAILED', 'BLOCKED'] })
  status?: 'SUCCESS' | 'FAILED' | 'BLOCKED';

  @Prop({ required: false })
  diagnosisCode?: string;

  @Prop({ required: false })
  decisionAction?: CommandId;

  @Prop({ required: false, enum: ['SYSTEM', 'BUSINESS'] })
  actionType?: ActionType;

  @Prop({ required: false, type: Object })
  prediction?: MlPredictionTrace;

  @Prop({ required: false, enum: ['success', 'failure', 'blocked', 'simulated'] })
  realOutcome?: 'success' | 'failure' | 'blocked' | 'simulated';

  @Prop({ required: false })
  error?: string;

  @Prop({ required: true })
  createdAt!: string;
}

export const AuditSchema = SchemaFactory.createForClass(AuditLog);
AuditSchema.index({ incidentId: 1, createdAt: -1 });
AuditSchema.index({ createdAt: -1 });
