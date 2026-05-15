import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  BrainDecision,
  CommandId,
  GatedExecutionResult,
  IncidentPayload,
  MlPredictionTrace,
} from '../common/types/brain.types';
import {
  ActionEffectivenessAnalyzer,
  OutcomeRecord,
} from './analyzers/action-effectiveness.analyzer';
import { Cron, CronExpression } from '@nestjs/schedule';
import { exec } from 'child_process';
import { promisify } from 'util';
import { PersistenceService } from '../persistence/persistence.service';

export interface LearningInsights {
  weakActions: CommandId[];
  strongActions: CommandId[];
  actionStats: Partial<Record<CommandId, { successRate: number; failureRate: number; total: number }>>;
  qualityScore: number;  // 0-1.0: Confidence in these insights (based on sample size and recency)
  totalOutcomes: number; // Total tracked outcomes
  windowMs: number;      // Time window for exponential decaying (2h half-life)
}

@Injectable()
export class LearningService implements OnModuleInit {
  private static readonly MAX_RECORDS = 500;
  private static readonly QUALITY_THRESHOLD = 50; // Min outcomes for high quality
  private static readonly HALF_LIFE_MS = 2 * 60 * 60 * 1000; // 2 hours

  private readonly logger = new Logger(LearningService.name);
  private readonly outcomeLog: OutcomeRecord[] = [];

  constructor(
    private readonly analyzer: ActionEffectivenessAnalyzer,
    private readonly persistenceService: PersistenceService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const records = await this.persistenceService.getRecentOutcomes(LearningService.MAX_RECORDS);
      this.outcomeLog.push(...records);
      this.logger.log(`[Learning] Loaded ${this.outcomeLog.length} outcome records from database`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[Learning] Could not load outcomes from database: ${msg} -- starting fresh`);
    }
  }

  record(
    event: IncidentPayload,
    decision: BrainDecision,
    executionResult: GatedExecutionResult | null,
    metadata?: {
      prediction?: MlPredictionTrace;
    },
  ): void {
    this.append({
      incidentId: event.id,
      action: decision.action,
      outcome: this.resolveOutcome(executionResult),
      input: event,
      ...(metadata?.prediction ? { prediction: metadata.prediction } : {}),
      realResult: {
        executed: executionResult?.executed ?? false,
        simulated: executionResult?.simulated ?? false,
        reason: executionResult?.reason ?? 'no_execution_result',
        output: executionResult?.output ?? '',
        error: executionResult?.error ?? null,
      },
    });
  }

  recordBlocked(action: CommandId): void {
    this.append({ action, outcome: 'blocked' });
  }

  getInsights(): LearningInsights {
    const effectiveness = this.analyzer.compute(this.outcomeLog);

    const actionStats: Partial<Record<CommandId, { successRate: number; failureRate: number; total: number }>> = {};
    let totalEffectiveOutcomes = 0;

    for (const e of effectiveness) {
      actionStats[e.action] = { successRate: e.successRate, failureRate: e.failureRate, total: e.total };
      totalEffectiveOutcomes += e.total;
    }

    // Quality score: based on sample size and recency
    // 0.0-1.0 scale: 0 outcomes = 0.0, 50+ outcomes with recent data = 1.0
    const qualityScore = Math.min(1.0, Math.max(0.0, totalEffectiveOutcomes / LearningService.QUALITY_THRESHOLD));

    return {
      weakActions: effectiveness.filter((e) => e.isWeak).map((e) => e.action),
      strongActions: effectiveness.filter((e) => !e.isWeak && e.successRate >= 0.7).map((e) => e.action),
      actionStats,
      qualityScore,
      totalOutcomes: this.outcomeLog.length,
      windowMs: LearningService.HALF_LIFE_MS,
    };
  }

  private append(record: Omit<OutcomeRecord, 'recordedAt'>): void {
    const full: OutcomeRecord = { ...record, recordedAt: new Date().toISOString() };
    this.outcomeLog.push(full);
    if (this.outcomeLog.length > LearningService.MAX_RECORDS) {
      this.outcomeLog.shift();
    }
    this.persistenceService.fireAndForget(
      this.persistenceService.saveOutcome(full),
      `saveOutcome incidentId=${full.incidentId ?? 'n/a'}`,
    );
  }

  private resolveOutcome(
    result: GatedExecutionResult | null,
  ): 'success' | 'failure' | 'blocked' | 'simulated' {
    if (result === null) return 'failure';
    if (result.simulated) return 'simulated';
    if (result.executed) return 'success';
    return 'failure';
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async retrainModel() {
    this.logger.log('[Learning] Starting model retraining');
    try {
      const execAsync = promisify(exec);
      const venvPython = join(process.cwd(), '.venv', 'Scripts', 'python.exe');
      const pythonCmd = existsSync(venvPython) ? `"${venvPython}"` : 'python';
      const retrainCommand = [
        `${pythonCmd} scripts/extract_real_dataset.py`,
        `${pythonCmd} scripts/data_pipeline.py --input-dir data/production_dataset --output-dir data/processed --dataset-type production`,
        `${pythonCmd} scripts/train_model.py`,
      ].join(' && ');

      const { stdout, stderr } = await execAsync(retrainCommand);
      this.logger.log(`[Learning] Retraining completed: ${stdout}`);
      if (stderr) this.logger.warn(`[Learning] Retraining stderr: ${stderr}`);
    } catch (error) {
      this.logger.error('[Learning] Retraining failed', error);
    }
  }

}
