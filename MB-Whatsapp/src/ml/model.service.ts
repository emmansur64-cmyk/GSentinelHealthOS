import { Injectable, Logger } from '@nestjs/common';
import { IncidentPayload } from '../common/types/brain.types';
import { MlCorePredictorService, MlTopFeature } from '../ml-core/predictor.service';
import { FeatureBuilder } from '../ml-core/feature-builder';
import { MlDecisionThresholds } from '../ml-core/model.loader';

export interface MlPredictionFeatures {
  hourOfDay: number;           // 0-23
  dayOfWeek: number;           // 0-6
  isStrongAction: number;      // 1.0 if in insights.strongActions, else 0.0
  isWeakAction: number;        // 1.0 if in insights.weakActions, else 0.0
  strategyConfidence: number;  // 0-1.0 from strategy
  actionRiskScore: number;     // 0-1.0 from diagnosis
}

export interface MlPredictionResult {
  action: string | null;
  confidence: number;         // 0-1.0
  source: 'ML' | 'HYBRID' | 'RULES';
  inferenceMs: number;
  probabilities?: number[];
  modelUsed: boolean;
  error?: string;
  features?: MlPredictionFeatures;
  featureVector?: number[];
  featureSchemaVersion?: string;
  topFeatures: MlTopFeature[];
}

@Injectable()
export class ModelService {
  private readonly logger = new Logger(ModelService.name);

  constructor(
    private readonly predictor: MlCorePredictorService,
    private readonly featureBuilder: FeatureBuilder,
  ) {}

  getDecisionThresholds(): MlDecisionThresholds {
    return this.predictor.getDecisionThresholds();
  }

  /**
   * Predict decision using enriched features
   * @param features Enriched feature vector with learning-based signals
   * @returns ML prediction with action and real confidence (0-1.0)
   */
  async predictDecision(
    incident: IncidentPayload,
    features: MlPredictionFeatures,
    strategy: string,
    rulesAction: string,
  ): Promise<MlPredictionResult> {
    const started = process.hrtime.bigint();

    const compatibility = this.featureBuilder.validateRuntimeCompatibility();
    if (!compatibility.ok) {
      const inferenceMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      this.logger.error(`[ML_SCHEMA_VALIDATION] ${compatibility.reason}`);
      return {
        action: null,
        confidence: 0,
        source: 'RULES',
        inferenceMs,
        probabilities: [],
        modelUsed: false,
        error: `feature_schema_mismatch: ${compatibility.reason}`,
        features,
        featureVector: [],
        featureSchemaVersion: this.featureBuilder.getSchemaInfo().featureSchemaVersion,
        topFeatures: [],
      };
    }

    let featureVector: number[] = [];
    let mlResult: Awaited<ReturnType<MlCorePredictorService['predict']>>;
    try {
      featureVector = this.featureBuilder.buildFeatures(incident, features, strategy, rulesAction);
      mlResult = await this.predictor.predict({
        incident,
        features,
        strategy,
        rulesAction,
      });
    } catch (error) {
      const inferenceMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[ML_INFERENCE_GUARD] ${msg}`);
      return {
        action: null,
        confidence: 0,
        source: 'RULES',
        inferenceMs,
        probabilities: [],
        modelUsed: false,
        error: `feature_validation_failed: ${msg}`,
        features,
        featureVector,
        featureSchemaVersion: this.featureBuilder.getSchemaInfo().featureSchemaVersion,
        topFeatures: [],
      };
    }

    const inferenceMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    const modelUsed = mlResult.action !== null;
    const thresholds = this.getDecisionThresholds();

    let source: 'ML' | 'HYBRID' | 'RULES' = 'RULES';
    if (modelUsed && mlResult.confidence >= thresholds.mlPrimary) {
      source = 'ML';
    } else if (modelUsed && mlResult.confidence >= thresholds.hybridMin) {
      source = 'HYBRID';
    }

    this.logger.debug(
      `[ML_INFERENCE] source=${source} confidence=${mlResult.confidence.toFixed(4)} latency_ms=${inferenceMs.toFixed(3)}`,
    );

    return {
      action: mlResult.action,
      confidence: mlResult.confidence,
      source,
      inferenceMs,
      probabilities: [],
      modelUsed,
      error: modelUsed ? undefined : 'onnx_prediction_unavailable',
      features,
      featureVector,
      featureSchemaVersion: this.featureBuilder.getSchemaInfo().featureSchemaVersion,
      topFeatures: mlResult.topFeatures,
    };
  }

  /**
   * Backward compatibility: simple prediction with basic features
   * @deprecated Use predictDecision(features: MlPredictionFeatures) instead
   */
  async predictDecisionBasic(hourOfDay: number, dayOfWeek: number): Promise<MlPredictionResult> {
    return this.predictDecision(
      {
        id: 'legacy-ml-predictor',
        source: 'legacy',
        message: 'legacy_ml_prediction',
        timestamp: new Date().toISOString(),
      },
      {
      hourOfDay,
      dayOfWeek,
      isStrongAction: 0.0,
      isWeakAction: 0.0,
      strategyConfidence: 0.0,
      actionRiskScore: 0.0,
      },
      'error',
      'retry_with_backoff',
    );
  }

  // === ONLINE LEARNING ACCESSORS (FASE 1) ===

  /**
   * Get current model version for tracking in online learning buffer
   */
  getModelVersion(): string {
    return this.predictor.getModelVersion?.() ?? 'v1';
  }

  /**
   * Get feature builder reference for feature name list (FASE 2)
   */
  getFeatureBuilder(): FeatureBuilder {
    return this.featureBuilder;
  }
}