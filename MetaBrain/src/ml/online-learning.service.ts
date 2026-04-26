import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { OnlineBufferService } from './online-buffer.service';
import { MlCoreModelLoader } from '../ml-core/model.loader';
import { OnlineTrainingBuffer } from '../persistence/schemas/online-training-buffer.schema';

const execAsync = promisify(exec);

/**
 * ONLINE LEARNING SERVICE
 *
 * Implements continuous learning from real-world feedback:
 * - FASE 3: Micro-batch aggregation from buffer
 * - FASE 4: Incremental dataset generation + retraining
 * - FASE 5: Safe model rollout (via loader hot-swap)
 * - FASE 6: Drift detection trigger
 *
 * Runs every X minutes to collect feedback and decide if retraining is needed.
 */
@Injectable()
export class OnlineLearningService {
  private readonly logger = new Logger(OnlineLearningService.name);
  private isRetrainingInProgress = false;
  private lastRetrainingTime: Date | null = null;

  constructor(
    private readonly onlineBufferService: OnlineBufferService,
    private readonly modelLoader: MlCoreModelLoader,
  ) {}

  /**
   * FASE 3: Micro-batch learning trigger
   * Runs every 5 minutes to check if we should retrain
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async triggerMicroBatchLearning(): Promise<void> {
    if (this.isRetrainingInProgress) {
      this.logger.debug('[OnlineLearning] Retraining already in progress, skipping');
      return;
    }

    try {
      // Get buffer statistics
      const stats = await this.getBufferStats();
      this.logger.debug(
        `[OnlineLearning] Buffer stats: total=${stats.totalRecords}, untrained=${stats.untrainedRecords}, with_outcome=${stats.recordsWithOutcome}`,
      );

      // Decision: retrain if we have enough new, quality feedback
      const shouldRetrain = await this.shouldTriggerRetrain(stats);
      if (!shouldRetrain) {
        this.logger.debug(
          '[OnlineLearning] Insufficient data for retraining, deferring',
        );
        return;
      }

      await this.executeIncrementalRetrain();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[OnlineLearning] Micro-batch trigger failed: ${msg}`);
    }
  }

  /**
   * FASE 3: Check if retraining is warranted
   */
  private async shouldTriggerRetrain(stats: {
    totalRecords: number;
    untrainedRecords: number;
    recordsWithOutcome: number;
    modelVersions: string[];
  }): Promise<boolean> {
    // Require minimum feedback with outcomes
    const MIN_UNTRAINED_WITH_OUTCOME = 20;
    if (stats.recordsWithOutcome < MIN_UNTRAINED_WITH_OUTCOME) {
      return false;
    }

    // Throttle: don't retrain more often than every 30 minutes
    if (this.lastRetrainingTime) {
      const timeSinceLastRetrain = Date.now() - this.lastRetrainingTime.getTime();
      const MIN_RETRAIN_INTERVAL_MS = 30 * 60 * 1000;
      if (timeSinceLastRetrain < MIN_RETRAIN_INTERVAL_MS) {
        this.logger.debug(
          `[OnlineLearning] Throttled: only ${(timeSinceLastRetrain / 1000).toFixed(0)}s since last retrain`,
        );
        return false;
      }
    }

    return true;
  }

  /**
   * FASE 4: Execute incremental retraining pipeline
   */
  private async executeIncrementalRetrain(): Promise<void> {
    this.isRetrainingInProgress = true;
    this.lastRetrainingTime = new Date();

    this.logger.log('[OnlineLearning] Starting incremental retraining...');

    try {
      // Step 1: Load untrained buffer records
      const bufferRecords = await this.onlineBufferService.getBatch(
        1000, // max records per batch
      );

      if (bufferRecords.length === 0) {
        this.logger.warn('[OnlineLearning] No quality records in buffer');
        return;
      }

      if (!this.isBatchValidForTraining(bufferRecords)) {
        this.logger.warn('[OnlineLearning] Invalid/corrupt records detected in batch. Retrain skipped.');
        return;
      }

      this.logger.log(
        `[OnlineLearning] Processing ${bufferRecords.length} buffer records for retraining`,
      );

      // Step 2: Export incremental dataset from buffer
      const incrementalDataPath = await this.exportIncrementalDataset(bufferRecords);
      this.logger.log(
        `[OnlineLearning] Exported incremental dataset: ${incrementalDataPath}`,
      );

      // Step 3: Trigger Python retraining script with incremental data
      const trainResult = await this.executeIncrementalTraining(incrementalDataPath);
      if (!trainResult.success) {
        this.logger.error(
          `[OnlineLearning] Training failed: ${trainResult.error}`,
        );
        return;
      }

      // Step 4: Evaluate deployment gate
      if (trainResult.gateResult?.passed) {
        this.logger.log(
          `[OnlineLearning] Model passed deployment gate, marking buffer records as used`,
        );
        // Mark these records as used in training
        const usedIds = bufferRecords.map((r) => r.incidentId);
        await this.onlineBufferService.clearProcessed(usedIds);
        await this.modelLoader.reloadModel();
      } else {
        this.logger.warn(
          `[OnlineLearning] Model did not pass deployment gate, checking reasons...`,
        );
        this.logger.warn(
          `Gate checks: ${JSON.stringify(trainResult.gateResult?.checks)}`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[OnlineLearning] Incremental retrain failed: ${msg}`,
      );
    } finally {
      this.isRetrainingInProgress = false;
    }
  }

  /**
   * FASE 3: Export buffer records as CSV for training
   */
  private async exportIncrementalDataset(
    bufferRecords: OnlineTrainingBuffer[],
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(
      process.cwd(),
      'data',
      'incremental',
      `training_buffer_${timestamp}.csv`,
    );

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Flatten buffer records into CSV format
    const rows = bufferRecords.map((record) => {
      const flattened: Record<string, any> = {
        incidentId: record.incidentId,
        source: record.source,
        action_predicted: record.mlPrediction?.modelAction ?? record.finalAction,
        confidence: record.mlPrediction?.modelConfidence ?? record.finalConfidence,
        action_actual: record.realOutcome?.outcome ?? null,
        outcome: record.realOutcome?.outcome ?? 'unknown',
        executed: record.realOutcome?.executed ?? false,
      };

      // Add all features from featureMap
      Object.assign(flattened, record.featureMap);

      // Add target (action)
      flattened.target_action = record.finalAction;

      return flattened;
    });

    const headerSet = new Set<string>();
    for (const row of rows) {
      Object.keys(row).forEach((k) => headerSet.add(k));
    }
    const headers = [...headerSet];

    const csvLine = (values: unknown[]): string =>
      values
        .map((v) => {
          const raw = v === null || v === undefined ? '' : String(v);
          const escaped = raw.replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(',');

    const lines = [
      csvLine(headers),
      ...rows.map((row) => csvLine(headers.map((h) => row[h]))),
    ];

    fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
    this.logger.debug(
      `[OnlineLearning] Exported ${rows.length} records to ${outputPath}`,
    );
    return outputPath;
  }

  /**
   * FASE 4: Execute Python incremental training
   */
  private async executeIncrementalTraining(
    incrementalDataPath: string,
  ): Promise<{
    success: boolean;
    error?: string;
    gateResult?: {
      passed: boolean;
      checks: Record<string, boolean>;
    };
  }> {
    const pythonScript = path.join(
      process.cwd(),
      'scripts',
      'train_model_incremental.py',
    );

    if (!fs.existsSync(pythonScript)) {
      return {
        success: false,
        error: `Script not found: ${pythonScript}`,
      };
    }

    try {
      this.logger.log(
        `[OnlineLearning] Executing: python ${pythonScript} ${incrementalDataPath}`,
      );
      const { stdout, stderr } = await execAsync(
        `python "${pythonScript}" "${incrementalDataPath}"`,
        { timeout: 5 * 60 * 1000 }, // 5 min timeout
      );

      // Check if training succeeded (look for deployment gate result in output)
      const gatePassedMatch = stdout.match(/DEPLOYMENT_GATE_PASSED/);
      const gatePassed = !!gatePassedMatch;

      // Try to parse gate result from stdout
      let gateResult = undefined;
      const gateReportMatch = stdout.match(
        /GATE_RESULT:(.+?)END_GATE_RESULT/s,
      );
      if (gateReportMatch) {
        try {
          gateResult = JSON.parse(gateReportMatch[1]);
        } catch {
          this.logger.warn('[OnlineLearning] Could not parse gate result');
        }
      }

      this.logger.log(
        `[OnlineLearning] Training completed. Gate passed: ${gatePassed}`,
      );

      if (stderr) {
        this.logger.warn(`[OnlineLearning] stderr: ${stderr}`);
      }

      return {
        success: true,
        gateResult: gateResult || { passed: gatePassed, checks: {} },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: msg,
      };
    }
  }

  /**
   * Manual trigger for on-demand retraining (via API endpoint)
   */
  async triggerManualRetrain(): Promise<{
    status: 'started' | 'already_running' | 'error';
    message: string;
  }> {
    if (this.isRetrainingInProgress) {
      return {
        status: 'already_running',
        message: 'Retraining is already in progress',
      };
    }

    try {
      const stats = await this.getBufferStats();
      void this.executeIncrementalRetrain(); // Fire and forget
      return {
        status: 'started',
        message: `Started incremental retraining with ${stats.untrainedRecords} untrained records`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        status: 'error',
        message: msg,
      };
    }
  }

  /**
   * Get current status
   */
  getStatus(): {
    isRetrainingInProgress: boolean;
    lastRetrainingTime: Date | null;
  } {
    return {
      isRetrainingInProgress: this.isRetrainingInProgress,
      lastRetrainingTime: this.lastRetrainingTime,
    };
  }

  private async getBufferStats(): Promise<{
    totalRecords: number;
    untrainedRecords: number;
    recordsWithOutcome: number;
    modelVersions: string[];
  }> {
    const sample = await this.onlineBufferService.getBatch(5000);
    const totalRecords = sample.length;
    const untrainedRecords = sample.length;
    const recordsWithOutcome = sample.filter((r) => r.realOutcome?.outcome).length;
    const modelVersions = Array.from(new Set(sample.map((r) => r.modelVersion).filter(Boolean)));
    return {
      totalRecords,
      untrainedRecords,
      recordsWithOutcome,
      modelVersions,
    };
  }

  private isBatchValidForTraining(batch: OnlineTrainingBuffer[]): boolean {
    if (batch.length === 0) return false;

    for (const row of batch) {
      if (!Array.isArray(row.onnxFeatureVector) || row.onnxFeatureVector.length === 0) {
        return false;
      }
      if (!row.realOutcome?.outcome) {
        return false;
      }
      if (row.onnxFeatureVector.some((v) => !Number.isFinite(v))) {
        return false;
      }
    }

    const byOutcome = new Map<string, number>();
    for (const row of batch) {
      const key = row.realOutcome?.outcome ?? 'unknown';
      byOutcome.set(key, (byOutcome.get(key) ?? 0) + 1);
    }

    // Safety: avoid training with one single class only.
    return byOutcome.size >= 2;
  }
}
