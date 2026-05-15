import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as ort from 'onnxruntime-node';

interface OnnxMetadata {
  action_classes?: string[];
  pipeline_version?: string;
  feature_schema_version?: string;
  feature_names_hash?: string;
  encoder_hash?: string;
  calibration?: MlCalibrationConfig;
  decision_thresholds?: {
    ml_primary?: number;
    hybrid_min?: number;
  };
  top_features_global?: MlFeatureImportanceEntry[];
}

export interface MlFeatureImportanceEntry {
  rank: number;
  feature: string;
  importance: number;
  importance_pct: number;
}

export interface MlDecisionThresholds {
  mlPrimary: number;
  hybridMin: number;
}

interface PlattCalibrationParam {
  type: 'platt' | 'identity';
  a?: number;
  b?: number;
}

interface IsotonicCalibrationParam {
  type: 'isotonic' | 'identity';
  x?: number[];
  y?: number[];
}

export interface MlCalibrationConfig {
  method?: 'none' | 'platt' | 'isotonic';
  class_count?: number;
  params?: Array<PlattCalibrationParam | IsotonicCalibrationParam>;
}

@Injectable()
export class MlCoreModelLoader implements OnModuleInit {
  private readonly logger = new Logger(MlCoreModelLoader.name);
  private readonly modelPath = join(process.cwd(), 'models', 'decision_model.onnx');
  private readonly metadataPath = join(process.cwd(), 'models', 'onnx_metadata.json');

  private session: ort.InferenceSession | null = null;
  private loadedAt: string | null = null;
  private actionClasses: string[] = [];
  private metadataInfo: {
    pipelineVersion: string;
    featureSchemaVersion: string;
    featureNamesHash: string;
    encoderHash: string;
  } = {
    pipelineVersion: 'unknown',
    featureSchemaVersion: 'unknown',
    featureNamesHash: 'unknown',
    encoderHash: 'unknown',
  };
  private calibrationConfig: MlCalibrationConfig = {
    method: 'none',
    class_count: 0,
    params: [],
  };
  private decisionThresholds: MlDecisionThresholds = {
    mlPrimary: 0.8,
    hybridMin: 0.6,
  };
  private topFeaturesGlobal: MlFeatureImportanceEntry[] = [];

  async onModuleInit(): Promise<void> {
    await this.loadModel();
    this.loadMetadata();
  }

  async loadModel(): Promise<ort.InferenceSession | null> {
    if (this.session) return this.session;

    if (!existsSync(this.modelPath)) {
      this.logger.warn(`ONNX model not found at ${this.modelPath}`);
      return null;
    }

    try {
      this.session = await ort.InferenceSession.create(this.modelPath, {
        executionProviders: ['cpuExecutionProvider'],
      });
      this.loadedAt = new Date().toISOString();
      this.logger.log(
        `ONNX model loaded. input=${this.session.inputNames[0]} outputs=${this.session.outputNames.join(',')}`,
      );
      return this.session;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to load ONNX model: ${msg}`);
      this.session = null;
      this.loadedAt = null;
      return null;
    }
  }

  async reloadModel(): Promise<boolean> {
    this.logger.log('Reloading ONNX model and metadata...');
    this.session = null;
    const loaded = await this.loadModel();
    this.loadMetadata();
    const ok = loaded !== null;
    if (ok) {
      this.logger.log(`ONNX reload completed at ${this.loadedAt ?? 'unknown'}`);
    } else {
      this.logger.warn('ONNX reload failed; previous session is unavailable');
    }
    return ok;
  }

  getRuntimeVersion(): { pipelineVersion: string; loadedAt: string | null } {
    return {
      pipelineVersion: this.metadataInfo.pipelineVersion,
      loadedAt: this.loadedAt,
    };
  }

  getSession(): ort.InferenceSession | null {
    return this.session;
  }

  getActionClasses(): string[] {
    return this.actionClasses;
  }

  getMetadataInfo(): {
    pipelineVersion: string;
    featureSchemaVersion: string;
    featureNamesHash: string;
    encoderHash: string;
  } {
    return this.metadataInfo;
  }

  getCalibrationConfig(): MlCalibrationConfig {
    return this.calibrationConfig;
  }

  getDecisionThresholds(): MlDecisionThresholds {
    return this.decisionThresholds;
  }

  getTopFeaturesGlobal(): MlFeatureImportanceEntry[] {
    return this.topFeaturesGlobal;
  }

  private loadMetadata(): void {
    if (!existsSync(this.metadataPath)) {
      this.logger.warn(`ONNX metadata not found at ${this.metadataPath}`);
      return;
    }

    try {
      const raw = readFileSync(this.metadataPath, 'utf-8');
      const parsed = JSON.parse(raw) as OnnxMetadata;
      this.actionClasses = parsed.action_classes ?? [];
      this.metadataInfo = {
        pipelineVersion: parsed.pipeline_version ?? 'unknown',
        featureSchemaVersion: parsed.feature_schema_version ?? 'unknown',
        featureNamesHash: parsed.feature_names_hash ?? 'unknown',
        encoderHash: parsed.encoder_hash ?? 'unknown',
      };
      this.calibrationConfig = parsed.calibration ?? {
        method: 'none',
        class_count: this.actionClasses.length,
        params: [],
      };

      const mlPrimaryRaw = parsed.decision_thresholds?.ml_primary;
      const hybridMinRaw = parsed.decision_thresholds?.hybrid_min;
      const mlPrimary = Number.isFinite(mlPrimaryRaw as number) ? Number(mlPrimaryRaw) : 0.8;
      const hybridMin = Number.isFinite(hybridMinRaw as number) ? Number(hybridMinRaw) : 0.6;
      this.decisionThresholds = {
        mlPrimary: Math.max(0, Math.min(1, mlPrimary)),
        hybridMin: Math.max(0, Math.min(1, Math.min(hybridMin, mlPrimary))),
      };
      this.topFeaturesGlobal = Array.isArray(parsed.top_features_global)
        ? (parsed.top_features_global as MlFeatureImportanceEntry[])
        : [];
      this.logger.log(`Loaded ONNX action classes: ${this.actionClasses.length} schema=${this.metadataInfo.featureSchemaVersion}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to load ONNX metadata: ${msg}`);
      this.actionClasses = [];
      this.metadataInfo = {
        pipelineVersion: 'unknown',
        featureSchemaVersion: 'unknown',
        featureNamesHash: 'unknown',
        encoderHash: 'unknown',
      };
      this.calibrationConfig = {
        method: 'none',
        class_count: 0,
        params: [],
      };
      this.decisionThresholds = {
        mlPrimary: 0.8,
        hybridMin: 0.6,
      };
      this.topFeaturesGlobal = [];
    }
  }
}
