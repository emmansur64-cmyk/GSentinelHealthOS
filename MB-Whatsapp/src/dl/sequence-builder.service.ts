import { Injectable } from '@nestjs/common';
import { IncidentPayload } from '../common/types/brain.types';
import { PersistenceService } from '../persistence/persistence.service';

@Injectable()
export class DlSequenceBuilderService {
  constructor(private readonly persistenceService: PersistenceService) {}

  async buildSequence(
    current: IncidentPayload,
    sequenceLength: number,
    featureColumns: string[],
  ): Promise<{ sequence: number[][]; sourceIncidentIds: string[] }> {
    const effectiveLen = Math.max(2, sequenceLength);
    const recent = await this.persistenceService.getRecentIncidents(effectiveLen - 1);

    const incidents = [...recent.map((r) => r.incident), current].slice(-effectiveLen);
    const sourceIncidentIds = incidents.map((x) => x.id);

    const sequence = incidents.map((incident, idx, all) =>
      this.encodeIncident(incident, idx, all, featureColumns),
    );

    // left pad if insufficient history
    while (sequence.length < effectiveLen) {
      sequence.unshift(new Array(featureColumns.length || 8).fill(0));
      sourceIncidentIds.unshift('pad');
    }

    return {
      sequence,
      sourceIncidentIds,
    };
  }

  private encodeIncident(
    incident: IncidentPayload,
    idx: number,
    all: IncidentPayload[],
    featureColumns: string[],
  ): number[] {
    const ts = new Date(incident.timestamp);
    const prevTs = idx > 0 ? new Date(all[idx - 1].timestamp) : ts;
    const gapMin = Math.max(0, (ts.getTime() - prevTs.getTime()) / 60000);
    const msgLen = (incident.message ?? '').length;
    const stackLen = (incident.stack ?? '').length;
    const sourceHash = this.hashToken(incident.source);
    const msgHash = this.hashToken(incident.message);
    const severityScore = this.deriveSeverityScore(incident);
    const metadataSize = incident.metadata ? Object.keys(incident.metadata).length : 0;

    const baseMap: Record<string, number> = {
      hour_of_day: ts.getHours(),
      day_of_week: ts.getDay(),
      time_since_last_min: gapMin,
      message_length: msgLen,
      stack_length: stackLen,
      source_hash: sourceHash,
      message_hash: msgHash,
      severity_score: severityScore,
      metadata_size: metadataSize,
    };

    if (!featureColumns.length) {
      return [
        baseMap.hour_of_day,
        baseMap.day_of_week,
        baseMap.time_since_last_min,
        baseMap.message_length,
        baseMap.stack_length,
        baseMap.source_hash,
        baseMap.message_hash,
        baseMap.severity_score,
      ];
    }

    return featureColumns.map((f) => {
      const v = baseMap[f];
      return Number.isFinite(v) ? v : 0;
    });
  }

  private hashToken(input: unknown): number {
    const str = String(input ?? '');
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
      hash = (hash * 31 + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash % 1000) / 1000;
  }

  private deriveSeverityScore(incident: IncidentPayload): number {
    const message = String(incident.message ?? '').toLowerCase();
    if (message.includes('critical') || message.includes('panic')) return 1.0;
    if (message.includes('error') || message.includes('failed')) return 0.75;
    if (message.includes('warn') || message.includes('degraded')) return 0.5;
    return 0.25;
  }
}
