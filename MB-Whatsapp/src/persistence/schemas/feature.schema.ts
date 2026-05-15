import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FeatureDocument = HydratedDocument<Feature>;

@Schema({ timestamps: true, collection: 'features' })
export class Feature {
  @Prop({ required: true })
  incidentId!: string;

  @Prop({ required: true })
  source!: string;

  @Prop({ required: true })
  decisionAction!: string;

  @Prop({ required: true, type: Object })
  featureMap!: Record<string, number>;

  @Prop({ required: false, type: [Number] })
  onnxFeatureVector?: number[];

  @Prop({ required: true })
  createdAt!: string;
}

export const FeatureSchema = SchemaFactory.createForClass(Feature);
FeatureSchema.index({ incidentId: 1, createdAt: -1 });
FeatureSchema.index({ createdAt: -1 });
