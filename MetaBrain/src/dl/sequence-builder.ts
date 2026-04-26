import { Injectable } from '@nestjs/common';
import { IncidentPayload } from '../common/types/brain.types';
import { AuditEntity } from '../audit/audit.entity';
import { PersistenceService } from '../persistence/persistence.service';

interface SequenceEvent {
  eventId: string;
  eventType: 'incident' | 'outcome' | 'audit';
  incidentId: string;
  timestamp: string;
  source: string;
  message: string;
  action: string;
  diagnosisCode: string;
  severityScore: number;
  statusScore: number;
  outcomeScore: number;
  frequency1h: number;
  frequency24h: number;
  frequency7d: number;
  retryCount: number;
  logsCount: number;
  metricsCount: number;
  latencyMs: number;
  errorsLast5m: number;
  cpuUsage: number;
  memoryUsage: number;
  metadataSize: number;
}

interface OutcomeEventRecord {
  incidentId: string;
  action: string;
  outcome: 'success' | 'failure' | 'blocked' | 'simulated';
  recordedAt: string;
}

interface SequenceBuildResult {
  sequence: number[][];
  sourceEventIds: string[];
}

const EVENT_TYPE_MAP: Record<SequenceEvent['eventType'], number> = {
  incident: 0,
  outcome: 1,
  audit: 2,
};

@Injectable()
export class SequenceBuilderService {
  constructor(private readonly persistenceService: PersistenceService) {}

  async buildSequence(
    current: IncidentPayload,
    sequenceLength: number,
    featureColumns: string[],
  ): Promise<SequenceBuildResult> {
    const effectiveLength = Math.max(2, sequenceLength);
    const fetchLimit = Math.max(effectiveLength * 4, 20);

    const [recentIncidents, recentAudits, recentOutcomes] = await Promise.all([
      this.persistenceService.getRecentIncidents(fetchLimit),
      this.persistenceService.getRecentAudits(fetchLimit),
      this.persistenceService.getRecentOutcomes(fetchLimit),
    ]);

    const incidentIndex = new Map(recentIncidents.map((record) => [record.incident.id, record.incident]));
    incidentIndex.set(current.id, current);

    const timeline = [
      ...recentIncidents.map((record) => this.toIncidentEvent(record.incident)),
      ...recentAudits.map((record) => this.toAuditEvent(record)),
      ...recentOutcomes.map((record) => this.toOutcomeEvent(record as OutcomeEventRecord, incidentIndex)),
      this.toIncidentEvent(current),
    ]
      .filter((event) => event.timestamp)
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp));

    const selected = timeline.slice(-effectiveLength);
    const sourceEventIds = selected.map((event) => event.eventId);
    const sequence = selected.map((event, index, events) =>
      this.encodeEvent(event, index, events, featureColumns),
    );

    while (sequence.length < effectiveLength) {
      sequence.unshift(new Array(featureColumns.length || 26).fill(0));
      sourceEventIds.unshift('pad');
    }

    return { sequence, sourceEventIds };
  }

  private toIncidentEvent(incident: IncidentPayload): SequenceEvent {
    const metadata = (incident.metadata ?? {}) as Record<string, unknown>;
    const data = (metadata.data ?? {}) as Record<string, unknown>;
    const metrics = (metadata.metrics ?? {}) as Record<string, unknown>;
    const logs = Array.isArray(metadata.logs) ? metadata.logs : [];

    return {
      eventId: `incident:${incident.id}`,
      eventType: 'incident',
      incidentId: incident.id,
      timestamp: incident.timestamp,
      source: incident.source,
      message: incident.message,
      action: '',
      diagnosisCode: String(metadata.originalType ?? 'unknown'),
      severityScore: this.deriveSeverityScore(incident, String(data.severity ?? '')),
      statusScore: 0,
      outcomeScore: 0,
      frequency1h: this.asNumber(data.frequency_1h),
      frequency24h: this.asNumber(data.frequency_24h),
      frequency7d: this.asNumber(data.frequency_7d),
      retryCount: this.asNumber(data.retry_count),
      logsCount: logs.length,
      metricsCount: Object.keys(metrics).length,
      latencyMs: this.asNumber(metrics.latency_ms),
      errorsLast5m: this.asNumber(metrics.errors_last_5m),
      cpuUsage: this.asNumber(metrics.cpu),
      memoryUsage: this.asNumber(metrics.memory),
      metadataSize: Object.keys(metadata).length,
    };
  }

  private toAuditEvent(record: AuditEntity): SequenceEvent {
    return {
      eventId: `audit:${record.incidentId}`,
      eventType: 'audit',
      incidentId: record.incidentId,
      timestamp: record.createdAt,
      source: record.source,
      message: String(record.decisionAction ?? ''),
      action: String(record.decisionAction ?? ''),
      diagnosisCode: String(record.diagnosisCode ?? ''),
      severityScore: 0,
      statusScore: this.toStatusScore(record.status),
      outcomeScore: 0,
      frequency1h: 0,
      frequency24h: 0,
      frequency7d: 0,
      retryCount: 0,
      logsCount: 0,
      metricsCount: 0,
      latencyMs: 0,
      errorsLast5m: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      metadataSize: 0,
    };
  }

  private toOutcomeEvent(
    record: OutcomeEventRecord,
    incidentIndex: Map<string, IncidentPayload>,
  ): SequenceEvent {
    const linkedIncident = incidentIndex.get(record.incidentId);

    return {
      eventId: `outcome:${record.incidentId}`,
      eventType: 'outcome',
      incidentId: record.incidentId,
      timestamp: record.recordedAt,
      source: linkedIncident?.source ?? 'unknown',
      message: record.outcome,
      action: record.action,
      diagnosisCode: '',
      severityScore: 0,
      statusScore: 0,
      outcomeScore: this.toOutcomeScore(record.outcome),
      frequency1h: 0,
      frequency24h: 0,
      frequency7d: 0,
      retryCount: 0,
      logsCount: 0,
      metricsCount: 0,
      latencyMs: 0,
      errorsLast5m: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      metadataSize: 0,
    };
  }

  private encodeEvent(
    event: SequenceEvent,
    index: number,
    all: SequenceEvent[],
    featureColumns: string[],
  ): number[] {
    const currentTs = new Date(event.timestamp);
    const previousTs = index > 0 ? new Date(all[index - 1].timestamp) : currentTs;
    const windowStartTs = new Date(all[0].timestamp);
    const previousEvents = all.slice(Math.max(0, index - 10), index);
    const context = this.computeWindowContext(previousEvents);

    const baseMap: Record<string, number> = {
      event_type_encoded: EVENT_TYPE_MAP[event.eventType] ?? 0,
      source_hash: this.hashToken(event.source),
      action_hash: this.hashToken(event.action),
      diagnosis_hash: this.hashToken(event.diagnosisCode),
      message_hash: this.hashToken(event.message),
      severity_score: event.severityScore,
      status_score: event.statusScore,
      outcome_score: event.outcomeScore,
      hour_of_day: currentTs.getUTCHours(),
      day_of_week: currentTs.getUTCDay(),
      time_since_prev_min: Math.max(0, (currentTs.getTime() - previousTs.getTime()) / 60000),
      relative_time_min: Math.max(0, (currentTs.getTime() - windowStartTs.getTime()) / 60000),
      frequency_1h: event.frequency1h,
      frequency_24h: event.frequency24h,
      frequency_7d: event.frequency7d,
      retry_count: event.retryCount,
      logs_count: event.logsCount,
      metrics_count: event.metricsCount,
      latency_ms: event.latencyMs,
      errors_last_5m: event.errorsLast5m,
      cpu_usage: event.cpuUsage,
      memory_usage: event.memoryUsage,
      success_rate_last_10: context.successRateLast10,
      failure_rate_last_10: context.failureRateLast10,
      audit_failure_rate_last_10: context.auditFailureRateLast10,
      metadata_size: event.metadataSize,
    };

    if (!featureColumns.length) {
      return Object.values(baseMap);
    }

    return featureColumns.map((column) => {
      const value = baseMap[column];
      return Number.isFinite(value) ? value : 0;
    });
  }

  private computeWindowContext(previousEvents: SequenceEvent[]): {
    successRateLast10: number;
    failureRateLast10: number;
    auditFailureRateLast10: number;
  } {
    const outcomes = previousEvents.filter((event) => event.eventType === 'outcome');
    const audits = previousEvents.filter((event) => event.eventType === 'audit');
    const successCount = outcomes.filter((event) => event.outcomeScore === 0).length;
    const failureCount = outcomes.filter((event) => event.outcomeScore >= 0.75).length;
    const auditFailureCount = audits.filter((event) => event.statusScore >= 0.75).length;

    return {
      successRateLast10: successCount / Math.max(1, outcomes.length),
      failureRateLast10: failureCount / Math.max(1, outcomes.length),
      auditFailureRateLast10: auditFailureCount / Math.max(1, audits.length),
    };
  }

  private hashToken(value: unknown): number {
    const text = String(value ?? '');
    let hashed = 0;
    for (let index = 0; index < text.length; index += 1) {
      hashed = (hashed * 31 + text.charCodeAt(index)) >>> 0;
    }
    return (hashed % 1000) / 1000;
  }

  private deriveSeverityScore(incident: IncidentPayload, severityRaw: string): number {
    const severity = severityRaw.toLowerCase();
    if (severity === 'critical') return 1;
    if (severity === 'high') return 0.75;
    if (severity === 'medium') return 0.5;
    if (severity === 'low') return 0.25;

    const message = incident.message.toLowerCase();
    if (message.includes('critical') || message.includes('panic') || message.includes('security')) return 1;
    if (message.includes('error') || message.includes('failed') || message.includes('crash')) return 0.75;
    if (message.includes('warn') || message.includes('degraded') || message.includes('timeout')) return 0.5;
    return 0.25;
  }

  private toStatusScore(status: string | undefined): number {
    if (status === 'FAILED') return 1;
    if (status === 'BLOCKED') return 0.75;
    return 0;
  }

  private toOutcomeScore(outcome: string | undefined): number {
    if (outcome === 'failure') return 1;
    if (outcome === 'blocked') return 0.75;
    if (outcome === 'simulated') return 0.25;
    return 0;
  }

  private asNumber(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
  }
}