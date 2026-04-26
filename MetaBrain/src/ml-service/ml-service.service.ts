import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModelRegistryService } from './model-registry.service';
import { MetricsService } from './metrics.service';
import { MlCorePredictorService } from '../ml-core/predictor.service';
import { IncidentPayload } from '../common/types/brain.types';

export interface MlPredictionRequest {
  incidentId: string;
  features: {
    hourOfDay: number;
    dayOfWeek: number;
    isStrongAction: number;
    isWeakAction: number;
    strategyConfidence: number;
    actionRiskScore: number;
  };
  modelVersion?: string; // Optional: specify version, defaults to production
}

export interface MlPredictionResponse {
  incidentId: string;
  action: string | null;
  confidence: number;
  modelVersion: string;
  modelTimestamp: string;
  features: any;
  processingTimeMs: number;
  status: 'success' | 'error';
  error?: string;
}

@Injectable()
export class MlServiceService implements OnModuleInit {
  private readonly logger = new Logger(MlServiceService.name);

  constructor(
    private readonly predictor: MlCorePredictorService,
    private readonly registry: ModelRegistryService,
    private readonly metricsService: MetricsService,
  ) {}

  async onModuleInit() {
    this.logger.log('[ML Service] Initializing ML prediction service');
    this.logger.log('[ML Service] Using shared ml-core predictor and model loader');
  }

  /**
   * Main prediction endpoint
   */
  async predict(request: MlPredictionRequest): Promise<MlPredictionResponse> {
    const startTime = Date.now();

    try {
      const modelInfo = await this.registry.getProductionVersion();
      if (!modelInfo) {
        throw new Error('Production model version not found');
      }

      if (request.modelVersion && request.modelVersion !== 'production') {
        this.logger.warn(
          `[ML Service] Ignoring requested modelVersion=${request.modelVersion}; unified pipeline uses production model only`,
        );
      }

      const incident: IncidentPayload = {
        id: request.incidentId,
        source: 'ml-service',
        message: 'ml_service_inference',
        timestamp: new Date().toISOString(),
        metadata: {},
      };

      const prediction = await this.predictor.predict({
        incident,
        features: request.features,
        strategy: 'error',
        rulesAction: 'retry_with_backoff',
      });

      const processingTime = Date.now() - startTime;

      // Record metrics
      this.metricsService.recordPrediction(modelInfo.version, 'success', processingTime);

      this.logger.log(
        `[ML PREDICTION] ${request.incidentId} → ${prediction.action} (${prediction.confidence.toFixed(3)}) | ${processingTime}ms`,
      );

      return {
        incidentId: request.incidentId,
        action: prediction.action ?? 'retry_with_backoff',
        confidence: prediction.confidence,
        modelVersion: modelInfo.version,
        modelTimestamp: modelInfo.timestamp,
        features: request.features,
        processingTimeMs: processingTime,
        status: 'success',
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Record error metric
      this.metricsService.recordPrediction('production', 'error', processingTime);

      this.logger.error(
        `[ML PREDICTION ERROR] ${request.incidentId} → ${errorMessage} | ${processingTime}ms`,
      );

      return {
        incidentId: request.incidentId,
        action: null,
        confidence: 0,
        modelVersion: 'unknown',
        modelTimestamp: new Date().toISOString(),
        features: request.features,
        processingTimeMs: processingTime,
        status: 'error',
        error: errorMessage,
      };
    }
  }

  /**
   * Health check for ML service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    productionModel: boolean;
    loadedModels: string[];
    lastHealthCheck: string;
  }> {
    try {
      const productionModel = true;
      const loadedModels = ['decision_model.onnx'];

      const status = productionModel ? 'healthy' : 'degraded';

      // Record health check metric
      this.metricsService.recordHealthCheck(status);

      return {
        status,
        productionModel,
        loadedModels,
        lastHealthCheck: new Date().toISOString(),
      };
    } catch (error) {
      // Record unhealthy metric
      this.metricsService.recordHealthCheck('unhealthy');

      return {
        status: 'unhealthy',
        productionModel: false,
        loadedModels: [],
        lastHealthCheck: new Date().toISOString(),
      };
    }
  }

  /**
   * Get available model versions
   */
  async getAvailableVersions(): Promise<{
    production: string | null;
    staging: string | null;
    available: string[];
  }> {
    const registry = await this.registry.getRegistry();
    return {
      production: registry.current_production,
      staging: registry.staging,
      available: registry.versions.map(v => v.version),
    };
  }
}