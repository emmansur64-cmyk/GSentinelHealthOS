import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OutcomeRecord } from '../learning/analyzers/action-effectiveness.analyzer';
import { IncidentMemoryRecord } from '../memory/schemas/incidents.schema';
import { AuditEntity } from '../audit/audit.entity';
import { AuditLog } from './schemas/audit.schema';
import { Decision } from './schemas/decision.schema';
import { Feature } from './schemas/feature.schema';
import { Incident } from './schemas/incident.schema';
import { Outcome } from './schemas/outcome.schema';
import {
  OnlineTrainingBuffer,
  OnlineTrainingBufferDocument,
} from './schemas/online-training-buffer.schema';
import { sanitizeForPersistence } from '../common/utils/persistence-sanitizer.util';
import { XaiDefenseReport } from './schemas/xai-defense-report.schema';

@Injectable()
export class PersistenceService {
  private readonly logger = new Logger(PersistenceService.name);

  constructor(
    @InjectModel(Incident.name) private readonly incidentModel: Model<Incident>,
    @InjectModel(Decision.name) private readonly decisionModel: Model<Decision>,
    @InjectModel(Outcome.name) private readonly outcomeModel: Model<Outcome>,
    @InjectModel(Feature.name) private readonly featureModel: Model<Feature>,
    @InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLog>,
    @InjectModel(OnlineTrainingBuffer.name)
    private readonly onlineTrainingBufferModel: Model<OnlineTrainingBufferDocument>,
    @InjectModel(XaiDefenseReport.name)
    private readonly xaiDefenseReportModel: Model<XaiDefenseReport>,
  ) {}

  async saveIncident(record: IncidentMemoryRecord): Promise<void> {
    const sanitized = sanitizeForPersistence(record);
    await this.incidentModel.create({
      incidentId: sanitized.incident.id,
      incident: sanitized.incident,
      decision: sanitized.decision,
      result: sanitized.result,
      prediction: sanitized.prediction,
      realOutcome: sanitized.realOutcome,
      storedAt: sanitized.storedAt,
    });
  }

  async saveDecision(record: IncidentMemoryRecord): Promise<void> {
    const sanitized = sanitizeForPersistence(record);
    await this.decisionModel.create({
      incidentId: sanitized.incident.id,
      source: sanitized.incident.source,
      action: sanitized.decision.action,
      strategy: sanitized.decision.strategy,
      confidence: sanitized.decision.confidence,
      reason: sanitized.decision.reason,
      createdAt: sanitized.storedAt,
    });
  }

  async saveFeatures(record: IncidentMemoryRecord): Promise<void> {
    const sanitized = sanitizeForPersistence(record);
    if (!sanitized.prediction?.features) return;
    await this.featureModel.create({
      incidentId: sanitized.incident.id,
      source: sanitized.incident.source,
      decisionAction: sanitized.decision.action,
      featureMap: sanitized.prediction.features,
      onnxFeatureVector: sanitized.prediction.onnxFeatureVector,
      createdAt: sanitized.storedAt,
    });
  }

  async saveOutcome(record: OutcomeRecord): Promise<void> {
    await this.outcomeModel.create(sanitizeForPersistence(record));
  }

  async saveAudit(record: AuditEntity): Promise<void> {
    await this.auditModel.create(sanitizeForPersistence(record));
  }

  async saveXaiDefenseReport(record: {
    caseId: string;
    sessionId?: string;
    mode: string;
    module: string;
    component: string;
    report: Record<string, unknown>;
    createdAt: string;
  }): Promise<void> {
    await this.xaiDefenseReportModel.create(sanitizeForPersistence(record));
  }

  async getRecentIncidents(limit: number): Promise<IncidentMemoryRecord[]> {
    const docs = await this.incidentModel
      .find({}, { _id: 0, __v: 0 })
      .sort({ storedAt: -1 })
      .limit(Math.max(1, limit))
      .lean<IncidentMemoryRecord[]>();
    return docs.reverse();
  }

  async getRecentOutcomes(limit: number): Promise<OutcomeRecord[]> {
    const docs = await this.outcomeModel
      .find({}, { _id: 0, __v: 0 })
      .sort({ recordedAt: -1 })
      .limit(Math.max(1, limit))
      .lean<OutcomeRecord[]>();
    return docs.reverse();
  }

  async getOutcomesSince(cutoffIso: string): Promise<OutcomeRecord[]> {
    return this.outcomeModel
      .find({ recordedAt: { $gte: cutoffIso } }, { _id: 0, __v: 0 })
      .sort({ recordedAt: 1 })
      .lean<OutcomeRecord[]>();
  }

  async getIncidentsByIds(ids: string[]): Promise<IncidentMemoryRecord[]> {
    if (ids.length === 0) return [];
    return this.incidentModel
      .find({ incidentId: { $in: ids } }, { _id: 0, __v: 0 })
      .lean<IncidentMemoryRecord[]>();
  }

  async getRecentAudits(limit: number): Promise<AuditEntity[]> {
    const docs = await this.auditModel
      .find({}, { _id: 0, __v: 0 })
      .sort({ createdAt: -1 })
      .limit(Math.max(1, limit))
      .lean<AuditEntity[]>();
    return docs.reverse();
  }

  fireAndForget<T>(promise: Promise<T>, context: string): void {
    void promise.catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[Persistence] ${context} failed: ${msg}`);
    });
  }

  // ===== ONLINE TRAINING BUFFER (FASE 1) =====

  /**
   * Save a decision + feedback context for online learning
   * Called right after a brain decision is made
   */
  async saveOnlineTrainingRecord(
    incidentId: string,
    source: string,
    input: any,
    featureMap: Record<string, number>,
    onnxFeatureVector: number[],
    featureNames: string[],
    mlPrediction: any,
    finalAction: string,
    finalConfidence: number,
    modelVersion: string,
  ): Promise<OnlineTrainingBufferDocument> {
    const sanitizedInput = sanitizeForPersistence(input);
    const sanitizedMlPrediction = sanitizeForPersistence(mlPrediction);
    const hasCompleteFeatures =
      onnxFeatureVector.length > 0 &&
      !onnxFeatureVector.some((v) => !Number.isFinite(v));
    const isSufficientlyConfident = finalConfidence >= 0.60;

    const record = await this.onlineTrainingBufferModel.create({
      incidentId,
      source,
      input: sanitizedInput,
      featureMap,
      onnxFeatureVector,
      featureNames,
      mlPrediction: sanitizedMlPrediction,
      finalAction,
      finalConfidence,
      realOutcome: undefined,
      decisionTimestamp: new Date(),
      outcomeTimestamp: undefined,
      usedInTraining: false,
      modelVersion,
      qualityMetadata: {
        hasCompleteFeatures,
        hasValidOutput: false, // Pending outcome
        isSufficientlyConfident,
        isFromEarlyTraining: false, // To be set by learning service
      },
    });

    this.logger.debug(
      `[OnlineTraining] Saved buffer record for ${incidentId}`,
    );
    return record;
  }

  /**
   * Update a buffer record with real outcome (when available)
   */
  async updateOnlineTrainingOutcome(
    incidentId: string,
    outcome: 'success' | 'failure' | 'blocked' | 'simulated',
    executed: boolean,
    error?: string,
  ): Promise<void> {
    await this.onlineTrainingBufferModel.updateOne(
      { incidentId },
      {
        $set: {
          realOutcome: { outcome, executed, error },
          outcomeTimestamp: new Date(),
          'qualityMetadata.hasValidOutput': true,
        },
      },
    );
    this.logger.debug(
      `[OnlineTraining] Updated outcome for ${incidentId}: ${outcome}`,
    );
  }

  async registerOnlineTrainingActualAction(
    incidentId: string,
    actionActual: string,
  ): Promise<void> {
    await this.onlineTrainingBufferModel.updateOne(
      { incidentId },
      {
        $set: {
          'realOutcome.actionActual': actionActual,
          outcomeTimestamp: new Date(),
          'qualityMetadata.hasValidOutput': true,
        },
      },
    );
    this.logger.debug(
      `[OnlineTraining] Registered real action for ${incidentId}: ${actionActual}`,
    );
  }

  /**
   * Get untrained buffer records (for micro-batch learning)
   */
  async getUntrainedBufferRecords(
    limit: number,
    minQualityThreshold: boolean = true,
  ): Promise<OnlineTrainingBuffer[]> {
    const query: any = { usedInTraining: false };
    if (minQualityThreshold) {
      query['qualityMetadata.hasCompleteFeatures'] = true;
      query['qualityMetadata.hasValidOutput'] = true;
    }

    return this.onlineTrainingBufferModel
      .find(query)
      .sort({ decisionTimestamp: 1 })
      .limit(Math.max(1, limit))
      .lean<OnlineTrainingBuffer[]>();
  }

  /**
   * Mark buffer records as used in training
   */
  async markBufferRecordsAsUsed(incidentIds: string[]): Promise<void> {
    if (incidentIds.length === 0) return;
    await this.onlineTrainingBufferModel.updateMany(
      { incidentId: { $in: incidentIds } },
      { $set: { usedInTraining: true } },
    );
    this.logger.debug(
      `[OnlineTraining] Marked ${incidentIds.length} records as used`,
    );
  }

  /**
   * Get buffer statistics (for monitoring)
   */
  async getOnlineTrainingBufferStats(): Promise<{
    totalRecords: number;
    untrainedRecords: number;
    recordsWithOutcome: number;
    modelVersions: string[];
  }> {
    const totalRecords = await this.onlineTrainingBufferModel.countDocuments();
    const untrainedRecords = await this.onlineTrainingBufferModel.countDocuments(
      { usedInTraining: false },
    );
    const recordsWithOutcome = await this.onlineTrainingBufferModel.countDocuments(
      { 'qualityMetadata.hasValidOutput': true },
    );
    const modelVersions = await this.onlineTrainingBufferModel.distinct(
      'modelVersion',
    );

    return {
      totalRecords,
      untrainedRecords,
      recordsWithOutcome,
      modelVersions,
    };
  }
}
