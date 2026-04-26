import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as ort from 'onnxruntime-node';

interface DlMetadata {
  model_type?: string;
  sequence_length?: number;
  feature_columns?: string[];
  anomaly_threshold?: number;
  feature_means?: number[];
  feature_stds?: number[];
  threshold_percentile?: number;
}

@Injectable()
export class DlModelLoader implements OnModuleInit {
  private readonly logger = new Logger(DlModelLoader.name);
  private readonly modelPath = join(process.cwd(), 'models', 'anomaly_model.onnx');
  private readonly metadataPath = join(process.cwd(), 'models', 'anomaly_model_metadata.json');

  private session: ort.InferenceSession | null = null;
  private metadata: DlMetadata = {
    model_type: 'unknown',
    sequence_length: 10,
    feature_columns: [],
    anomaly_threshold: 0.75,
    feature_means: [],
    feature_stds: [],
    threshold_percentile: 95,
  };

  async onModuleInit(): Promise<void> {
    await this.loadModel();
    this.loadMetadata();
  }

  async loadModel(): Promise<void> {
    if (!existsSync(this.modelPath)) {
      this.logger.warn(`[DL] model not found at ${this.modelPath}`);
      return;
    }

    try {
      this.session = await ort.InferenceSession.create(this.modelPath, {
        executionProviders: ['cpuExecutionProvider'],
      });
      this.logger.log(`[DL] ONNX model loaded input=${this.session.inputNames[0]}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[DL] failed to load model: ${msg}`);
      this.session = null;
    }
  }

  async reload(): Promise<boolean> {
    this.session = null;
    await this.loadModel();
    this.loadMetadata();
    return this.session !== null;
  }

  private loadMetadata(): void {
    if (!existsSync(this.metadataPath)) {
      this.logger.warn(`[DL] metadata not found at ${this.metadataPath}`);
      return;
    }

    try {
      const raw = readFileSync(this.metadataPath, 'utf-8');
      const parsed = JSON.parse(raw) as DlMetadata;
      this.metadata = {
        model_type: parsed.model_type ?? 'unknown',
        sequence_length: Number(parsed.sequence_length ?? 10),
        feature_columns: Array.isArray(parsed.feature_columns) ? parsed.feature_columns : [],
        anomaly_threshold: Number(parsed.anomaly_threshold ?? 0.75),
        feature_means: Array.isArray(parsed.feature_means)
          ? parsed.feature_means.map((value) => Number(value))
          : [],
        feature_stds: Array.isArray(parsed.feature_stds)
          ? parsed.feature_stds.map((value) => Number(value))
          : [],
        threshold_percentile: Number(parsed.threshold_percentile ?? 95),
      };
      this.logger.log(
        `[DL] metadata loaded sequence_length=${this.metadata.sequence_length} threshold=${this.metadata.anomaly_threshold}`,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[DL] failed to parse metadata: ${msg}`);
    }
  }

  getSession(): ort.InferenceSession | null {
    return this.session;
  }

  getMetadata(): DlMetadata {
    return this.metadata;
  }

  getAnomalyThreshold(): number {
    return Number.isFinite(this.metadata.anomaly_threshold)
      ? Number(this.metadata.anomaly_threshold)
      : 0.75;
  }

  getSequenceLength(): number {
    return Number.isFinite(this.metadata.sequence_length)
      ? Number(this.metadata.sequence_length)
      : 12;
  }

  getFeatureColumns(): string[] {
    return Array.isArray(this.metadata.feature_columns)
      ? this.metadata.feature_columns
      : [];
  }

  getFeatureMeans(): number[] {
    return Array.isArray(this.metadata.feature_means) ? this.metadata.feature_means : [];
  }

  getFeatureStds(): number[] {
    return Array.isArray(this.metadata.feature_stds) ? this.metadata.feature_stds : [];
  }
}
