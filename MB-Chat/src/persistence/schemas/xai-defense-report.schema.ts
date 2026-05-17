import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type XaiDefenseReportDocument = HydratedDocument<XaiDefenseReport>;

@Schema({ timestamps: true, collection: 'xai_defense_reports' })
export class XaiDefenseReport {
  @Prop({ required: true, index: true })
  caseId!: string;

  @Prop({ required: false, index: true })
  sessionId?: string;

  @Prop({ required: true, index: true })
  mode!: string;

  @Prop({ required: true })
  module!: string;

  @Prop({ required: true })
  component!: string;

  @Prop({ required: true, type: Object })
  report!: Record<string, unknown>;

  @Prop({ required: true, index: true })
  createdAt!: string;
}

export const XaiDefenseReportSchema = SchemaFactory.createForClass(XaiDefenseReport);
XaiDefenseReportSchema.index({ caseId: 1, createdAt: -1 });
XaiDefenseReportSchema.index({ mode: 1, createdAt: -1 });
