import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { IncidentPayload, CommandId, MlTopFeatureTrace } from '../../common/types/brain.types';

export type OnlineTrainingBufferDocument = HydratedDocument<OnlineTrainingBuffer>;

@Schema({ timestamps: true, collection: 'online_training_buffer' })
export class OnlineTrainingBuffer {
  /**
   * Unique incident identifier
   */
  @Prop({ required: true, index: true })
  incidentId!: string;

  /**
   * Source system/tenant
   */
  @Prop({ required: true })
  source!: string;

  /**
   * Full incident input payload
   */
  @Prop({ required: true, type: Object })
  input!: IncidentPayload;

  /**
   * Feature map (human-readable key-value pairs)
   */
  @Prop({ required: true, type: Object })
  featureMap!: Record<string, number>;

  /**
   * Exact ONNX feature vector used in inference (float32 array)
   * Must match order from feature-builder.ts
   */
  @Prop({ required: true, type: [Number] })
  onnxFeatureVector!: number[];

  /**
   * Ordered list of feature names (for reproducibility)
   */
  @Prop({ required: true, type: [String] })
  featureNames!: string[];

  /**
   * ML prediction result
   */
  @Prop({
    required: true,
    type: {
      modelAction: String,
      modelConfidence: Number,
      mlSource: String, // 'ML', 'HYBRID', 'RULES'
      topFeatures: [
        {
          feature: String,
          value: Number,
          importance: Number,
          contributionScore: Number,
        },
      ],
    },
  })
  mlPrediction!: {
    modelAction: CommandId;
    modelConfidence: number;
    mlSource: 'ML' | 'HYBRID' | 'RULES';
    topFeatures: MlTopFeatureTrace[];
  };

  /**
   * Final decision (may differ from ML if rules override or HYBRID combined)
   */
  @Prop({ required: true })
  finalAction!: CommandId;

  /**
   * Final confidence used in decision
   */
  @Prop({ required: true })
  finalConfidence!: number;

  /**
   * Real outcome (recorded after execution/feedback),
   * null until outcome is known
   */
  @Prop({
    required: false,
    type: {
      outcome: String, // 'success' | 'failure' | 'blocked' | 'simulated'
      executed: Boolean,
      error: String,
      actionActual: String,
    },
  })
  realOutcome?: {
    outcome: 'success' | 'failure' | 'blocked' | 'simulated';
    executed: boolean;
    error?: string;
    actionActual?: string;
  };

  /**
   * Timestamp when decision was made
   */
  @Prop({ required: true })
  decisionTimestamp!: Date;

  /**
   * Timestamp when real outcome was recorded (null if pending)
   */
  @Prop({ required: false })
  outcomeTimestamp?: Date;

  /**
   * Whether this record has been used in training
   */
  @Prop({ required: true, default: false, index: true })
  usedInTraining!: boolean;

  /**
   * Model version used for prediction
   */
  @Prop({ required: true })
  modelVersion!: string;

  /**
   * Quality flags for training filtering
   */
  @Prop({
    required: true,
    type: {
      hasCompleteFeatures: Boolean, // no NaN/null
      hasValidOutput: Boolean, // outcome is not null
      isSufficientlyConfident: Boolean, // confidence >= 0.60
      isFromEarlyTraining: Boolean, // model was still learning
    },
  })
  qualityMetadata!: {
    hasCompleteFeatures: boolean;
    hasValidOutput: boolean;
    isSufficientlyConfident: boolean;
    isFromEarlyTraining: boolean;
  };
}

export const OnlineTrainingBufferSchema = SchemaFactory.createForClass(
  OnlineTrainingBuffer,
);

// Indexes for efficient querying
OnlineTrainingBufferSchema.index({ incidentId: 1 });
OnlineTrainingBufferSchema.index({ createdAt: -1 });
OnlineTrainingBufferSchema.index({ usedInTraining: 1, createdAt: -1 });
OnlineTrainingBufferSchema.index({ modelVersion: 1, createdAt: -1 });
OnlineTrainingBufferSchema.index({
  'qualityMetadata.hasValidOutput': 1,
  'qualityMetadata.hasCompleteFeatures': 1,
  createdAt: -1,
});
