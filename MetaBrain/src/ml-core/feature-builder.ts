import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { IncidentPayload } from '../common/types/brain.types';

export interface MlCoreRuntimeFeatures {
  hourOfDay: number;
  dayOfWeek: number;
  isStrongAction: number;
  isWeakAction: number;
  strategyConfidence: number;
  actionRiskScore: number;
}

interface OnnxMetadata {
  pipeline_version?: string;
  feature_schema_version?: string;
  feature_names_hash?: string;
  encoder_hash?: string;
  action_encoder_hash?: string;
  num_features: number;
  feature_names: string[];
  feature_defaults?: Record<string, number>;
  encoder_mappings?: Record<string, Record<string, number>>;
}

const RUNTIME_SUPPORTED_FEATURES = [
  'hour_of_day',
  'day_of_week',
  'day_of_month',
  'month',
  'time_since_last_min',
  'time_since_last_normalized',
  'incidents_last_1h',
  'incidents_last_24h',
  'incidents_last_7d',
  'incidents_1h_normalized',
  'incidents_24h_normalized',
  'incidents_7d_normalized',
  'rolling_frequency',
  'logs_count',
  'metrics_count',
  'has_data',
  'logs_count_normalized',
  'metrics_count_normalized',
  'success_rate_last_10',
  'failure_rate_last_10',
  'success_rate_today',
  'action_historical_success_rate',
  'type_action_success_rate',
  'last_action_success',
  'retry_count_1h',
  'retry_count_normalized',
  'escalation_flag',
  'action_effectiveness_score',
  'incident_type_encoded',
  'source_encoded',
  'original_type_encoded',
  'diagnosis_code_encoded',
  'strategy_encoded',
  'severity_encoded',
  'action_type_encoded',
  'source_category_encoded',
  'last_action_taken_encoded',
] as const;

@Injectable()
export class FeatureBuilder {
  private readonly logger = new Logger(FeatureBuilder.name);
  private readonly metadataPath = join(process.cwd(), 'models', 'onnx_metadata.json');

  private metadata: OnnxMetadata = {
    num_features: 0,
    feature_names: [],
    feature_defaults: {},
    encoder_mappings: {},
  };
  private schemaValidationError: string | null = null;

  private readonly runtimeState = {
    lastTimestampMs: 0,
    incidentsLast1h: 0,
    incidentsLast24h: 0,
    incidentsLast7d: 0,
  };

  constructor() {
    this.loadMetadata();
  }

  buildFeatures(
    incident: IncidentPayload,
    modelFeatures: MlCoreRuntimeFeatures,
    strategy: string,
    action: string,
  ): number[] {
    if (this.schemaValidationError) {
      throw new Error(this.schemaValidationError);
    }

    const byName: Record<string, number> = {};
    const defaults = this.metadata.feature_defaults ?? {};

    for (const featureName of this.metadata.feature_names) {
      byName[featureName] = defaults[featureName] ?? 0.0;
    }

    const incidentDate = new Date(incident.timestamp);
    const nowMs = incidentDate.getTime();
    const prevMs = this.runtimeState.lastTimestampMs;

    const deltaMinutes = prevMs > 0 ? Math.max(0, (nowMs - prevMs) / 60000) : 60;
    this.runtimeState.lastTimestampMs = nowMs;
    this.runtimeState.incidentsLast1h += 1;
    this.runtimeState.incidentsLast24h += 1;
    this.runtimeState.incidentsLast7d += 1;

    const metadata = (incident.metadata ?? {}) as Record<string, unknown>;
    const data = (metadata.data ?? {}) as Record<string, unknown>;
    const metrics = (metadata.metrics ?? {}) as Record<string, unknown>;
    const logs = Array.isArray(metadata.logs) ? metadata.logs : [];

    const severityRaw = this.asString(data.severity) || this.inferSeverity(incident.message);
    const sourceCategory = incident.source.includes('_') ? incident.source.split('_')[0] : incident.source;
    const originalType = this.asString(metadata.originalType) || 'unknown';

    const retryCount1h = this.asNumber(data.retry_count, 0);
    const incidentsLast1h = this.asNumber(data.frequency_1h, this.runtimeState.incidentsLast1h);
    const incidentsLast24h = this.asNumber(data.frequency_24h, this.runtimeState.incidentsLast24h);
    const incidentsLast7d = this.asNumber(data.frequency_7d, this.runtimeState.incidentsLast7d);

    byName.hour_of_day = modelFeatures.hourOfDay;
    byName.day_of_week = modelFeatures.dayOfWeek;
    byName.day_of_month = incidentDate.getUTCDate();
    byName.month = incidentDate.getUTCMonth() + 1;

    byName.time_since_last_min = deltaMinutes;
    byName.time_since_last_normalized = this.clamp(deltaMinutes / 1440);
    byName.incidents_last_1h = incidentsLast1h;
    byName.incidents_last_24h = incidentsLast24h;
    byName.incidents_last_7d = incidentsLast7d;
    byName.incidents_1h_normalized = this.clamp(incidentsLast1h / 50);
    byName.incidents_24h_normalized = this.clamp(incidentsLast24h / 500);
    byName.incidents_7d_normalized = this.clamp(incidentsLast7d / 2000);

    byName.rolling_frequency = this.clamp((incidentsLast1h + incidentsLast24h / 24) / 10);

    byName.logs_count = logs.length;
    byName.metrics_count = Object.keys(metrics).length;
    byName.has_data = Object.keys(data).length > 0 ? 1 : 0;
    byName.logs_count_normalized = this.clamp(logs.length / 50);
    byName.metrics_count_normalized = this.clamp(Object.keys(metrics).length / 50);

    byName.success_rate_last_10 = 0.5 + modelFeatures.isStrongAction * 0.3 - modelFeatures.isWeakAction * 0.2;
    byName.failure_rate_last_10 = this.clamp(1 - byName.success_rate_last_10);
    byName.success_rate_today = byName.success_rate_last_10;
    byName.action_historical_success_rate = this.clamp(byName.success_rate_last_10 + 0.05);
    byName.type_action_success_rate = this.clamp(byName.success_rate_last_10);
    byName.last_action_success = byName.success_rate_last_10 >= 0.5 ? 1 : 0;

    byName.retry_count_1h = retryCount1h;
    byName.retry_count_normalized = this.clamp(retryCount1h / 10);
    byName.escalation_flag = severityRaw === 'critical' ? 1 : 0;
    byName.action_effectiveness_score = this.clamp(modelFeatures.strategyConfidence);

    byName.incident_type_encoded = this.encode('incident_type', incident.message);
    byName.source_encoded = this.encode('source', incident.source);
    byName.original_type_encoded = this.encode('original_type', originalType);
    byName.diagnosis_code_encoded = this.encode('diagnosis_code', this.asString((metadata.systemBrain as Record<string, unknown>)?.pattern) || 'unknown');
    byName.strategy_encoded = this.encode('strategy', strategy);
    byName.severity_encoded = this.encode('severity', severityRaw);
    byName.action_type_encoded = this.encode('action_type', action.includes('restart') ? 'SYSTEM' : 'BUSINESS');
    byName.source_category_encoded = this.encode('source_category', sourceCategory);
    byName.last_action_taken_encoded = this.encode('last_action_taken', action);

    const vector = this.metadata.feature_names.map((name) => this.ensureNumeric(byName[name]));

    if (vector.length !== this.metadata.num_features) {
      throw new Error(
        `Feature length mismatch: expected ${this.metadata.num_features}, got ${vector.length}`,
      );
    }

    return vector;
  }

  getSchemaInfo(): {
    pipelineVersion: string;
    featureSchemaVersion: string;
    featureNamesHash: string;
    encoderHash: string;
  } {
    return {
      pipelineVersion: this.metadata.pipeline_version ?? 'unknown',
      featureSchemaVersion: this.metadata.feature_schema_version ?? 'unknown',
      featureNamesHash: this.metadata.feature_names_hash ?? 'unknown',
      encoderHash: this.metadata.encoder_hash ?? 'unknown',
    };
  }

  /** Returns the zero-based index of a feature name in the model's feature vector, or -1 if not found. */
  getFeatureIndex(featureName: string): number {
    return this.metadata.feature_names.indexOf(featureName);
  }

  getFeatureNames(): string[] {
    return [...this.metadata.feature_names];
  }

  validateRuntimeCompatibility(): { ok: true } | { ok: false; reason: string } {
    if (this.schemaValidationError) {
      return { ok: false, reason: this.schemaValidationError };
    }
    return { ok: true };
  }

  private loadMetadata(): void {
    if (!existsSync(this.metadataPath)) {
      this.logger.warn(`ONNX metadata not found at ${this.metadataPath}`);
      return;
    }

    try {
      const raw = readFileSync(this.metadataPath, 'utf-8');
      const parsed = JSON.parse(raw) as OnnxMetadata;
      this.metadata = {
        pipeline_version: parsed.pipeline_version,
        feature_schema_version: parsed.feature_schema_version,
        feature_names_hash: parsed.feature_names_hash,
        encoder_hash: parsed.encoder_hash,
        action_encoder_hash: parsed.action_encoder_hash,
        num_features: parsed.num_features,
        feature_names: parsed.feature_names ?? [],
        feature_defaults: parsed.feature_defaults ?? {},
        encoder_mappings: parsed.encoder_mappings ?? {},
      };
      this.schemaValidationError = this.validateSchema(this.metadata);
      if (this.schemaValidationError) {
        this.logger.error(`[ML_SCHEMA_MISMATCH] ${this.schemaValidationError}`);
      }
      this.logger.log(
        `Loaded ONNX metadata: ${this.metadata.feature_names.length} features schema=${this.metadata.feature_schema_version ?? 'unknown'} pipeline=${this.metadata.pipeline_version ?? 'unknown'}`,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to load ONNX metadata: ${msg}`);
      this.schemaValidationError = `onnx_metadata_load_error: ${msg}`;
    }
  }

  private validateSchema(metadata: OnnxMetadata): string | null {
    if (!Array.isArray(metadata.feature_names) || metadata.feature_names.length === 0) {
      return 'feature_names missing in metadata';
    }

    if (!metadata.feature_schema_version) {
      return 'feature_schema_version missing in metadata';
    }

    if (metadata.num_features !== metadata.feature_names.length) {
      return `num_features mismatch metadata.num_features=${metadata.num_features} metadata.feature_names=${metadata.feature_names.length}`;
    }

    if (metadata.feature_names_hash) {
      const computed = createHash('sha256').update(metadata.feature_names.join('\n'), 'utf8').digest('hex');
      if (computed !== metadata.feature_names_hash) {
        return 'feature_names_hash mismatch between metadata and feature_names';
      }
    }

    const supported = new Set<string>(RUNTIME_SUPPORTED_FEATURES);
    const missingInRuntime = metadata.feature_names.filter((name) => !supported.has(name));
    if (missingInRuntime.length > 0) {
      return `runtime does not implement model features: ${missingInRuntime.join(', ')}`;
    }

    return null;
  }

  private encode(column: string, value: string): number {
    const mappings = this.metadata.encoder_mappings?.[column] ?? {};
    if (Object.prototype.hasOwnProperty.call(mappings, value)) {
      return mappings[value];
    }

    const unknownKeys = ['unknown', 'UNK', 'other'];
    for (const key of unknownKeys) {
      if (Object.prototype.hasOwnProperty.call(mappings, key)) {
        return mappings[key];
      }
    }
    return 0;
  }

  private inferSeverity(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('critical') || lower.includes('security')) return 'critical';
    if (lower.includes('error') || lower.includes('crash')) return 'high';
    if (lower.includes('timeout') || lower.includes('warning')) return 'medium';
    return 'low';
  }

  private asNumber(input: unknown, fallback: number): number {
    if (typeof input === 'number' && Number.isFinite(input)) return input;
    if (typeof input === 'string') {
      const parsed = Number(input);
      if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
  }

  private asString(input: unknown): string {
    return typeof input === 'string' ? input : '';
  }

  private ensureNumeric(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    return 0;
  }

  private clamp(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
  }
}
