import { Injectable, Logger } from '@nestjs/common';
import * as ort from 'onnxruntime-node';
import { IncidentPayload } from '../common/types/brain.types';
import { FeatureBuilder, MlCoreRuntimeFeatures } from './feature-builder';
import { MlCoreModelLoader, MlDecisionThresholds, MlFeatureImportanceEntry } from './model.loader';

export interface MlCorePredictInput {
  incident: IncidentPayload;
  features: MlCoreRuntimeFeatures;
  strategy: string;
  rulesAction: string;
}

export interface MlTopFeature {
  feature: string;
  value: number;
  importance: number;
  contributionScore: number;
}

export interface MlCorePredictOutput {
  action: string | null;
  confidence: number;
  topFeatures: MlTopFeature[];
}

@Injectable()
export class MlCorePredictorService {
  private readonly logger = new Logger(MlCorePredictorService.name);

  constructor(
    private readonly modelLoader: MlCoreModelLoader,
    private readonly featureBuilder: FeatureBuilder,
  ) {}

  async predict(input: MlCorePredictInput): Promise<MlCorePredictOutput> {
    const featureVector = this.featureBuilder.buildFeatures(
      input.incident,
      input.features,
      input.strategy,
      input.rulesAction,
    );

    const session = this.modelLoader.getSession();
    if (!session) {
      return { action: null, confidence: 0, topFeatures: [] };
    }

    try {
      const inputName = session.inputNames[0] ?? 'float_input';
      const tensor = new ort.Tensor('float32', Float32Array.from(featureVector), [1, featureVector.length]);
      const feeds: Record<string, ort.Tensor> = { [inputName]: tensor };
      const outputs = await session.run(feeds);

      const probabilities = this.extractProbabilities(outputs);
      const calibratedProbabilities = this.applyCalibration(probabilities);
      const { index, confidence } = this.argmax(calibratedProbabilities);
      const actions = this.modelLoader.getActionClasses();
      const topFeatures = this.computeTopFeatures(featureVector);

      return {
        action: actions[index] ?? null,
        confidence,
        topFeatures,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`ONNX prediction failed: ${msg}`);
      return { action: null, confidence: 0, topFeatures: [] };
    }
  }

  getDecisionThresholds(): MlDecisionThresholds {
    return this.modelLoader.getDecisionThresholds();
  }

  /**
   * Get model version/pipeline version for online learning tracking
   */
  getModelVersion(): string {
    const info = this.modelLoader.getMetadataInfo();
    return info?.pipelineVersion ?? 'v1';
  }

  private computeTopFeatures(featureVector: number[], topN = 5): MlTopFeature[] {
    const globalImportances: MlFeatureImportanceEntry[] = this.modelLoader.getTopFeaturesGlobal();
    if (globalImportances.length === 0 || featureVector.length === 0) return [];

    const featureNames = this.featureBuilder.getSchemaInfo().featureNamesHash
      ? undefined
      : undefined;
    void featureNames; // names are embedded in globalImportances already

    const scored = globalImportances.map((entry) => {
      const featureIdx = this.featureBuilder.getFeatureIndex(entry.feature);
      const value = featureIdx >= 0 && featureIdx < featureVector.length
        ? featureVector[featureIdx]
        : 0;
      return {
        feature: entry.feature,
        value: Number.isFinite(value) ? value : 0,
        importance: entry.importance,
        contributionScore: Math.abs(Number.isFinite(value) ? value : 0) * entry.importance,
      };
    });

    return scored
      .sort((a, b) => b.contributionScore - a.contributionScore)
      .slice(0, topN);
  }

  private extractProbabilities(outputs: Record<string, ort.Tensor>): number[] {
    const outputEntries = Object.entries(outputs);
    for (const [name, output] of outputEntries) {
      const value = output as unknown;
      if (name.toLowerCase().includes('prob') || name.toLowerCase().includes('probabilities')) {
        const extracted = this.asProbabilityArray(value);
        if (extracted.length > 0) return extracted;
      }
    }

    for (const [, output] of outputEntries) {
      const extracted = this.asProbabilityArray(output as unknown);
      if (extracted.length > 0) return extracted;
    }

    return [];
  }

  private asProbabilityArray(output: unknown): number[] {
    if (!output || typeof output !== 'object') return [];

    const tensorLike = output as { data?: unknown };
    if (tensorLike.data && ArrayBuffer.isView(tensorLike.data)) {
      const values = Array.from(tensorLike.data as unknown as Iterable<unknown>, (x) => Number(x));
      if (values.length > 0) return this.normalize(values);
    }

    const data = tensorLike.data as unknown;
    if (Array.isArray(data) && data.length > 0) {
      const first = data[0] as unknown;
      if (first && typeof first === 'object' && !Array.isArray(first)) {
        const mapValues = Object.values(first as Record<string, unknown>).map((x) => Number(x));
        if (mapValues.length > 0 && mapValues.every((x) => Number.isFinite(x))) {
          return this.normalize(mapValues);
        }
      }

      const flat = data.map((x) => Number(x));
      if (flat.length > 0 && flat.every((x) => Number.isFinite(x))) {
        return this.normalize(flat);
      }
    }

    return [];
  }

  private normalize(values: number[]): number[] {
    const nonNegative = values.map((x) => (Number.isFinite(x) ? Math.max(0, x) : 0));
    const sum = nonNegative.reduce((acc, x) => acc + x, 0);
    if (sum <= 0) return nonNegative;
    return nonNegative.map((x) => x / sum);
  }

  private applyCalibration(values: number[]): number[] {
    const probs = this.normalize(values);
    if (probs.length === 0) return probs;

    const calibration = this.modelLoader.getCalibrationConfig();
    const method = calibration.method ?? 'none';
    const params = calibration.params ?? [];

    if (method === 'platt') {
      const calibrated = probs.map((p, i) => {
        const param = (params[i] ?? { type: 'identity' }) as {
          type?: string;
          a?: number;
          b?: number;
        };
        if (param.type !== 'platt') return p;
        const clipped = Math.max(1e-6, Math.min(1 - 1e-6, p));
        const logit = Math.log(clipped / (1 - clipped));
        const a = Number.isFinite(param.a) ? Number(param.a) : 1;
        const b = Number.isFinite(param.b) ? Number(param.b) : 0;
        return 1 / (1 + Math.exp(-(a * logit + b)));
      });
      return this.normalize(calibrated);
    }

    if (method === 'isotonic') {
      const calibrated = probs.map((p, i) => {
        const param = (params[i] ?? { type: 'identity' }) as {
          type?: string;
          x?: number[];
          y?: number[];
        };
        if (param.type !== 'isotonic') return p;
        const x = Array.isArray(param.x) ? param.x : [];
        const y = Array.isArray(param.y) ? param.y : [];
        if (x.length < 2 || x.length !== y.length) return p;
        return this.interpolate(p, x, y);
      });
      return this.normalize(calibrated);
    }

    return probs;
  }

  private interpolate(value: number, x: number[], y: number[]): number {
    if (value <= x[0]) return y[0];
    if (value >= x[x.length - 1]) return y[y.length - 1];

    for (let i = 1; i < x.length; i += 1) {
      if (value <= x[i]) {
        const x0 = x[i - 1];
        const x1 = x[i];
        const y0 = y[i - 1];
        const y1 = y[i];
        const width = x1 - x0;
        if (width <= 0) return y0;
        const ratio = (value - x0) / width;
        return y0 + ratio * (y1 - y0);
      }
    }

    return y[y.length - 1];
  }

  private argmax(values: number[]): { index: number; confidence: number } {
    if (values.length === 0) return { index: 0, confidence: 0 };

    let max = values[0];
    let idx = 0;
    for (let i = 1; i < values.length; i += 1) {
      if (values[i] > max) {
        max = values[i];
        idx = i;
      }
    }
    return { index: idx, confidence: max };
  }
}
