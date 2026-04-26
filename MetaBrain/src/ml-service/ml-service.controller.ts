import { Controller, Post, Get, Body, Query, Logger } from '@nestjs/common';
import { MlServiceService, MlPredictionRequest, MlPredictionResponse } from './ml-service.service';
import { MetricsService } from './metrics.service';
import { ModelMonitorService } from './model-monitor.service';

@Controller('ml')
export class MlServiceController {
  private readonly logger = new Logger(MlServiceController.name);

  constructor(
    private readonly mlService: MlServiceService,
    private readonly metricsService: MetricsService,
    private readonly modelMonitorService: ModelMonitorService,
  ) {}

  /**
   * POST /ml/predict
   * Main prediction endpoint
   */
  @Post('predict')
  async predict(@Body() request: MlPredictionRequest): Promise<MlPredictionResponse> {
    this.logger.debug(`[API] Prediction request for incident ${request.incidentId}`);
    return this.mlService.predict(request);
  }

  /**
   * GET /ml/health
   * Health check endpoint
   */
  @Get('health')
  async health() {
    this.logger.debug('[API] Health check request');
    return this.mlService.healthCheck();
  }

  /**
   * GET /ml/versions
   * Get available model versions
   */
  @Get('versions')
  async getVersions() {
    this.logger.debug('[API] Versions request');
    return this.mlService.getAvailableVersions();
  }

  /**
   * POST /ml/batch-predict
   * Batch prediction endpoint for multiple incidents
   */
  @Post('batch-predict')
  async batchPredict(@Body() requests: MlPredictionRequest[]): Promise<MlPredictionResponse[]> {
    this.logger.debug(`[API] Batch prediction request for ${requests.length} incidents`);

    const results = await Promise.all(
      requests.map(request => this.mlService.predict(request))
    );

    return results;
  }

  /**
   * GET /ml/metrics
   * Get service metrics in Prometheus format
   */
  @Get('metrics')
  async getMetrics(@Query('format') format?: string) {
    if (format === 'prometheus') {
      return this.metricsService.getMetrics();
    }

    // Return summary statistics by default
    return {
      uptime_seconds: process.uptime(),
      ...this.metricsService.getSummaryStats(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /ml/monitor/status
   * Latest monitoring snapshot (for dashboard).
   */
  @Get('monitor/status')
  getMonitorStatus() {
    const latest = this.modelMonitorService.getLatestReport();
    return (
      latest ?? {
        status: 'UNKNOWN',
        message: 'No monitoring snapshot available yet',
        timestamp: new Date().toISOString(),
      }
    );
  }

  /**
   * GET /ml/monitor/alerts?limit=50
   * Recent alerts for timeline widgets.
   */
  @Get('monitor/alerts')
  getMonitorAlerts(@Query('limit') limit?: string) {
    const parsedLimit = Number(limit);
    const safeLimit = Number.isFinite(parsedLimit) ? Math.max(1, Math.round(parsedLimit)) : 50;
    return {
      alerts: this.modelMonitorService.getRecentAlerts(safeLimit),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * POST /ml/monitor/run
   * Manual execution for smoke tests and operations.
   */
  @Post('monitor/run')
  async runMonitorNow() {
    this.logger.log('[API] Manual model monitor run requested');
    return this.modelMonitorService.runHealthCheck('manual');
  }
}