import { Injectable } from '@nestjs/common';
import { register, collectDefaultMetrics, Gauge, Counter, Histogram } from 'prom-client';

@Injectable()
export class MetricsService {
  // Métricas de predicciones
  private readonly predictionsTotal = new Counter({
    name: 'ml_service_predictions_total',
    help: 'Total number of predictions made',
    labelNames: ['model_version', 'status'],
  });

  private readonly predictionDuration = new Histogram({
    name: 'ml_service_prediction_duration_seconds',
    help: 'Duration of prediction requests',
    labelNames: ['model_version'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
  });

  // Métricas de modelos
  private readonly modelsLoaded = new Gauge({
    name: 'ml_service_models_loaded',
    help: 'Number of models currently loaded in memory',
  });

  private readonly modelLoadDuration = new Histogram({
    name: 'ml_service_model_load_duration_seconds',
    help: 'Duration of model loading operations',
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  });

  // Métricas de caché
  private readonly cacheHits = new Counter({
    name: 'ml_service_cache_hits_total',
    help: 'Total number of cache hits',
  });

  private readonly cacheMisses = new Counter({
    name: 'ml_service_cache_misses_total',
    help: 'Total number of cache misses',
  });

  // Métricas de health checks
  private readonly healthChecksTotal = new Counter({
    name: 'ml_service_health_checks_total',
    help: 'Total number of health checks performed',
    labelNames: ['status'],
  });

  private readonly monitorRunsTotal = new Counter({
    name: 'ml_service_monitor_runs_total',
    help: 'Total number of model monitoring executions',
    labelNames: ['status'],
  });

  private readonly monitorRunDuration = new Histogram({
    name: 'ml_service_monitor_run_duration_seconds',
    help: 'Duration of model monitoring executions',
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  });

  private readonly monitorAlertsTotal = new Counter({
    name: 'ml_service_monitor_alerts_total',
    help: 'Total model monitoring alerts emitted',
    labelNames: ['metric', 'severity'],
  });

  constructor() {
    // Recopilar métricas por defecto del proceso
    collectDefaultMetrics({ prefix: 'ml_service_' });
  }

  // Métodos para registrar métricas de predicciones
  recordPrediction(modelVersion: string, status: 'success' | 'error', duration: number) {
    this.predictionsTotal.inc({ model_version: modelVersion, status });
    this.predictionDuration.observe({ model_version: modelVersion }, duration / 1000); // Convertir a segundos
  }

  // Métodos para métricas de modelos
  setModelsLoaded(count: number) {
    this.modelsLoaded.set(count);
  }

  recordModelLoad(duration: number) {
    this.modelLoadDuration.observe(duration / 1000);
  }

  // Métodos para métricas de caché
  recordCacheHit() {
    this.cacheHits.inc();
  }

  recordCacheMiss() {
    this.cacheMisses.inc();
  }

  // Métodos para health checks
  recordHealthCheck(status: 'healthy' | 'degraded' | 'unhealthy') {
    this.healthChecksTotal.inc({ status });
  }

  recordMonitorRun(status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL', durationMs: number) {
    this.monitorRunsTotal.inc({ status });
    this.monitorRunDuration.observe(durationMs / 1000);
  }

  recordMonitorAlert(
    metric: 'accuracy_drift' | 'data_drift' | 'overfitting_change',
    severity: 'INFO' | 'WARNING' | 'CRITICAL',
  ) {
    this.monitorAlertsTotal.inc({ metric, severity });
  }

  // Obtener métricas en formato Prometheus
  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  // Obtener estadísticas resumidas
  getSummaryStats() {
    return {
      predictions: {
        total: 0,
        success: 0,
        error: 0,
      },
      models: {
        loaded: 0,
      },
      cache: {
        hits: 0,
        misses: 0,
        hitRate: 0,
      },
      health: {
        totalChecks: 0,
      },
      monitor: {
        runs: 0,
        alerts: 0,
      },
    };
  }
}