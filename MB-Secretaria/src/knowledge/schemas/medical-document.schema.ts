import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MedicalDocumentEntityDocument = HydratedDocument<MedicalDocumentEntity>;

@Schema({ timestamps: true, collection: 'medical_documents' })
export class MedicalDocumentEntity {
  @Prop({ required: true })
  content!: string;

  @Prop({ required: true, type: [Number] })
  embedding!: number[];

  @Prop({ required: true })
  source!: string;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  abstract!: string;

  @Prop({ required: true })
  url!: string;

  @Prop({ required: true })
  date!: string;

  @Prop({ required: true, type: [String] })
  keywords!: string[];

  @Prop({
    required: true,
    type: {
      externalId: String,
      country: String,
      sourcePriority: Number,
      indexedAt: String,
    },
  })
  metadata!: {
    externalId?: string;
    country?: string;
    sourcePriority: number;
    indexedAt: string;
  };
}

export const MedicalDocumentSchema = SchemaFactory.createForClass(MedicalDocumentEntity);
MedicalDocumentSchema.index({ source: 1, date: -1 });
MedicalDocumentSchema.index({ url: 1 }, { unique: true });
MedicalDocumentSchema.index({ 'metadata.sourcePriority': -1, createdAt: -1 });
