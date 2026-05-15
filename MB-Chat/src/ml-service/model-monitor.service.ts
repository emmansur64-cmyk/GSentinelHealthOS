import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MetricsService } from './metrics.service';
import { PersistenceService } from '../persistence/persistence.service';
import { OutcomeRecord } from '../learning/analyzers/action-effectiveness.analyzer';
import { IncidentMemoryRecord } from '../memory/schemas/incidents.schema';

type MonitorSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
type MonitorStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL';

interface BaselineMetrics {
  timestamp?: string;
  train_accuracy?: number;
  test_accuracy?: number;
  overfitting_score?: number;
}

export interface MonitorAlert {
  severity: MonitorSeverity;
  metric: 'accuracy_drift' | 'data_drift' | 'overfitting_change';
  currentValue: number;
  threshold: number;
  message: string;
  timestamp: string;
}

export interface MonitorSnapshot {
  timestamp: string;
  status: MonitorStatus;
  metrics: {
    baselineAccuracy: number;
    currentAccuracy: number;
    accuracyDrift: number;
    baselineOverfitting: number;
    currentOverfitting: number;
    overfittingChange: number;
    dataDriftScore: number;
    sampleSize: number;
  };
  alerts: MonitorAlert[];
  config: {
    intervalMinutes: number;
    lookbackMinutes: number;
  };
}

interface MonitorConfig {
  intervalMinutes: number;
  lookbackMinutes: number;
  accuracyWarnThreshold: number;
  accuracyCriticalThreshold: number;
  dataDriftWarnThreshold: number;
  dataDriftCriticalThreshold: number;
  overfitWarnThreshold: number;
  overfitCriticalThreshold: number;
  minSamples: number;
  webhookUrl: string | null;
}

@Injectable()
export class ModelMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ModelMonitorService.name);

  private readonly baselinePath = join(process.cwd(), 'models', 'model_metrics.json');
  private readonly monitorDir = join(process.cwd(), 'models', 'monitoring');
  private readonly latestReportPath = join(this.monitorDir, 'latest_health_check.json');
  private readonly historyPath = join(this.monitorDir, 'health_history.jsonl');

  private timer: NodeJS.Timeout | null = null;
  private latestReport: MonitorSnapshot | null = null;
  private readonly alertsHistory: MonitorAlert[] = [];

  private readonly config: MonitorConfig = {
    intervalMinutes: this.intFromEnv('ML_MONITOR_INTERVAL_MINUTES', 10),
    lookbackMinutes: this.intFromEnv('ML_MONITOR_LOOKBACK_MINUTES', 120),
    accuracyWarnThreshold: this.floatFromEnv('ML_MONITOR_ACCURACY_WARN_DROP', 0.05),
    accuracyCriticalThreshold: this.floatFromEnv('ML_MONITOR_ACCURACY_CRITICAL_DROP', 0.1),
    dataDriftWarnThreshold: this.floatFromEnv('ML_MONITOR_DATA_DRIFT_WARN', 0.3),
    dataDriftCriticalThreshold: this.floatFromEnv('ML_MONITOR_DATA_DRIFT_CRITICAL', 0.45),
    overfitWarnThreshold: this.floatFromEnv('ML_MONITOR_OVERFIT_WARN', 0.1),
    overfitCriticalThreshold: this.floatFromEnv('ML_MONITOR_OVERFIT_CRITICAL', 0.2),
    minSamples: this.intFromEnv('ML_MONITOR_MIN_SAMPLES', 20),
    webhookUrl: process.env.ML_MONITOR_WEBHOOK_URL?.trim() || null,
  };

  constructor(
    private readonly metricsService: MetricsService,
    private readonly persistenceService: PersistenceService,
  ) {}

  onModuleInit(): void {
    this.ensureMonitoringDir();
    this.logger.log(
      JSON.stringify({
        event: 'ml_monitor_started',
        intervalMinutes: this.config.intervalMinutes,
        lookbackMinutes: this.config.lookbackMinutes,
        webhookEnabled: Boolean(this.config.webhookUrl),
      }),
    );

    this.schedule();
    void this.runHealthCheck('startup');
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runHealthCheck(reason: 'startup' | 'interval' | 'manual' = 'interval'): Promise<MonitorSnapshot> {
    const startedAt = Date.now();
    const baseline = this.readJsonFile<BaselineMetrics>(this.baselinePath) ?? {};

    const baselineAccuracy = this.safeNumber(baseline.test_accuracy, 0.5);
    const baselineTrainAccuracy = this.safeNumber(baseline.train_accuracy, baselineAccuracy);
    const baselineOverfitting = this.safeNumber(baseline.overfitting_score, 0);

    const cutoffMs = Date.now() - this.config.lookbackMinutes * 60_000;
    const cutoffIso = new Date(cutoffMs).toISOString();
    const recentOutcomes = await this.persistenceService.getOutcomesSince(cutoffIso);
    const incidentIds = Array.from(new Set(recentOutcomes.map((o) => o.incidentId).filter(Boolean))) as string[];
    const incidents = await this.persistenceService.getIncidentsByIds(incidentIds);

    const currentAccuracy = this.computeOutcomeAccuracy(recentOutcomes, baselineAccuracy);
    const accuracyDrift = Math.max(0, baselineAccuracy - currentAccuracy);

    const currentOverfitting = Math.max(0, baselineTrainAccuracy - currentAccuracy);
    const overfittingChange = Math.max(0, currentOverfitting - baselineOverfitting);

    const baselineSeverityDistribution = this.computeSeverityDistribution(incidents);
    const recentSeverityDistribution = this.computeSeverityDistribution(incidents, new Set(recentOutcomes.map((o) => o.incidentId ?? '')));
    const dataDriftScore = this.computeTotalVariationDistance(
      baselineSeverityDistribution,
      recentSeverityDistribution,
    );

    const alerts: MonitorAlert[] = [];
    this.pushMetricAlert(
      alerts,
      'accuracy_drift',
      accuracyDrift,
      this.config.accuracyWarnThreshold,
      this.config.accuracyCriticalThreshold,
      `Accuracy drift detected (drop=${accuracyDrift.toFixed(4)} vs baseline=${baselineAccuracy.toFixed(4)})`,
    );
    this.pushMetricAlert(
      alerts,
      'data_drift',
      dataDriftScore,
      this.config.dataDriftWarnThreshold,
      this.config.dataDriftCriticalThreshold,
      `Data drift detected (score=${dataDriftScore.toFixed(4)} in recent incidents)`,
    );
    this.pushMetricAlert(
      alerts,
      'overfitting_change',
      overfittingChange,
      this.config.overfitWarnThreshold,
      this.config.overfitCriticalThreshold,
      `Overfitting change detected (delta=${overfittingChange.toFixed(4)})`,
    );

    if (recentOutcomes.length < this.config.minSamples) {
      alerts.push({
        severity: 'INFO',
        metric: 'accuracy_drift',
        currentValue: recentOutcomes.length,
        threshold: this.config.minSamples,
        message: `Low sample size for robust monitoring (${recentOutcomes.length}/${this.config.minSamples})`,
        timestamp: new Date().toISOString(),
      });
    }

    const status = this.resolveStatus(alerts);
    const snapshot: MonitorSnapshot = {
      timestamp: new Date().toISOString(),
      status,
      metrics: {
        baselineAccuracy,
        currentAccuracy,
        accuracyDrift,
        baselineOverfitting,
        currentOverfitting,
        overfittingChange,
        dataDriftScore,
        sampleSize: recentOutcomes.length,
      },
      alerts,
      config: {
        intervalMinutes: this.config.intervalMinutes,
        lookbackMinutes: this.config.lookbackMinutes,
      },
    };

    const durationMs = Date.now() - startedAt;
    this.latestReport = snapshot;
    this.persistReport(snapshot);
    this.captureAlerts(alerts);

    this.metricsService.recordMonitorRun(status, durationMs);
    for (const alert of alerts) {
      this.metricsService.recordMonitorAlert(alert.metric, alert.severity);
    }

    this.logger.log(
      JSON.stringify({
        event: 'ml_monitor_run',
        reason,
        status: snapshot.status,
        durationMs,
        metrics: snapshot.metrics,
        alertCount: alerts.length,
      }),
    );

    if (alerts.some((a) => a.severity === 'WARNING' || a.severity === 'CRITICAL')) {
      await this.sendWebhook(snapshot);
    }

    return snapshot;
  }

  getLatestReport(): MonitorSnapshot | null {
    if (this.latestReport) return this.latestReport;
    return this.readJsonFile<MonitorSnapshot>(this.latestReportPath);
  }

  getRecentAlerts(limit = 50): MonitorAlert[] {
    return this.alertsHistory.slice(-Math.max(1, limit));
  }

  private schedule(): void {
    const everyMs = Math.max(1, this.config.intervalMinutes) * 60_000;
    this.timer = setInterval(() => {
      void this.runHealthCheck('interval');
    }, everyMs);
  }

  private ensureMonitoringDir(): void {
    if (!existsSync(this.monitorDir)) {
      mkdirSync(this.monitorDir, { recursive: true });
    }
  }

  private persistReport(snapshot: MonitorSnapshot): void {
    writeFileSync(this.latestReportPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    writeFileSync(this.historyPath, `${JSON.stringify(snapshot)}\n`, { encoding: 'utf-8', flag: 'a' });
  }

  private captureAlerts(alerts: MonitorAlert[]): void {
    this.alertsHistory.push(...alerts);
    const maxInMemory = 200;
    if (this.alertsHistory.length > maxInMemory) {
      this.alertsHistory.splice(0, this.alertsHistory.length - maxInMemory);
    }
  }

  private async sendWebhook(snapshot: MonitorSnapshot): Promise<void> {
    if (!this.config.webhookUrl) return;

    try {
      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'metabrain-ml-monitor',
          type: 'ml_degradation_alert',
          payload: snapshot,
        }),
      });

      if (!response.ok) {
        this.logger.warn(
          JSON.stringify({
            event: 'ml_monitor_webhook_failed',
            status: response.status,
            statusText: response.statusText,
          }),
        );
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        JSON.stringify({
          event: 'ml_monitor_webhook_error',
          message: msg,
        }),
      );
    }
  }

  private pushMetricAlert(
    alerts: MonitorAlert[],
    metric: MonitorAlert['metric'],
    currentValue: number,
    warnThreshold: number,
    criticalThreshold: number,
    message: string,
  ): void {
    let severity: MonitorSeverity | null = null;
    let threshold = warnThreshold;

    if (currentValue >= criticalThreshold) {
      severity = 'CRITICAL';
      threshold = criticalThreshold;
    } else if (currentValue >= warnThreshold) {
      severity = 'WARNING';
    }

    if (!severity) return;

    alerts.push({
      severity,
      metric,
      currentValue,
      threshold,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  private resolveStatus(alerts: MonitorAlert[]): MonitorStatus {
    if (alerts.some((a) => a.severity === 'CRITICAL')) return 'CRITICAL';
    if (alerts.some((a) => a.severity === 'WARNING')) return 'DEGRADED';
    return 'HEALTHY';
  }

  private computeOutcomeAccuracy(outcomes: OutcomeRecord[], fallback: number): number {
    if (!Array.isArray(outcomes) || outcomes.length === 0) return fallback;

    let effective = 0;
    let successes = 0;
    for (const outcome of outcomes) {
      if (outcome.outcome === 'success' || outcome.outcome === 'failure') {
        effective += 1;
      }
      if (outcome.outcome === 'success') {
        successes += 1;
      }
    }

    if (effective === 0) return fallback;
    return successes / effective;
  }

  private computeSeverityDistribution(
    incidents: IncidentMemoryRecord[],
    incidentFilter?: Set<string>,
  ): Record<string, number> {
    const counts: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
      unknown: 0,
    };

    for (const record of incidents) {
      const incident = record.incident;
      if (!incident?.id) continue;
      if (incidentFilter && !incidentFilter.has(incident.id)) continue;

      const metadata = incident.metadata as { data?: { severity?: string }; severity?: string } | undefined;
      const rawSeverity = metadata?.data?.severity ?? metadata?.severity ?? 'unknown';
      const severity = this.normalizeSeverity(rawSeverity);
      counts[severity] = (counts[severity] ?? 0) + 1;
    }

    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    if (total <= 0) {
      return {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
        unknown: 1,
      };
    }

    const distribution: Record<string, number> = {};
    for (const [key, value] of Object.entries(counts)) {
      distribution[key] = value / total;
    }
    return distribution;
  }

  private computeTotalVariationDistance(a: Record<string, number>, b: Record<string, number>): number {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    let total = 0;
    for (const key of keys) {
      total += Math.abs((a[key] ?? 0) - (b[key] ?? 0));
    }
    return total / 2;
  }

  private normalizeSeverity(value: string): 'low' | 'medium' | 'high' | 'critical' | 'unknown' {
    const normalized = String(value).toLowerCase();
    if (normalized === 'low') return 'low';
    if (normalized === 'medium') return 'medium';
    if (normalized === 'high') return 'high';
    if (normalized === 'critical') return 'critical';
    return 'unknown';
  }

  private readJsonFile<T>(path: string): T | null {
    try {
      if (!existsSync(path)) return null;
      const raw = readFileSync(path, 'utf-8');
      return JSON.parse(raw) as T;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        JSON.stringify({
          event: 'ml_monitor_read_error',
          path,
          message: msg,
        }),
      );
      return null;
    }
  }

  private parseDateMs(value?: string): number {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private safeNumber(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
  }

  private intFromEnv(key: string, fallback: number): number {
    const raw = process.env[key];
    if (!raw) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.round(parsed));
  }

  private floatFromEnv(key: string, fallback: number): number {
    const raw = process.env[key];
    if (!raw) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0, parsed);
  }
}