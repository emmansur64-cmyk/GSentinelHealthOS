import { Injectable } from '@nestjs/common';
import { IncidentMemoryRecord } from '../../memory/schemas/incidents.schema';

export interface FrequencyAnalysis {
  similarEvents: number;
  recentFailures: number;
  repeatDetected: boolean;
  shouldThrottle: boolean;
}

@Injectable()
export class FrequencyAnalyzer {
  private static readonly DEFAULT_WINDOW_MINUTES = 10;
  private static readonly REPEAT_THRESHOLD = 3;
  private static readonly THROTTLE_THRESHOLD = 6;

  analyze(
    recentRecords: IncidentMemoryRecord[],
    eventType: string,
    source: string,
    windowMinutes = FrequencyAnalyzer.DEFAULT_WINDOW_MINUTES,
  ): FrequencyAnalysis {
    const now = Date.now();
    const windowStart = now - windowMinutes * 60 * 1000;

    const recent = recentRecords.filter((record) => {
      const storedAt = Date.parse(record.storedAt);
      return Number.isFinite(storedAt) && storedAt >= windowStart;
    });

    const sameEvent = recent.filter((record) => this.getEventType(record) === eventType);
    const sameSource = sameEvent.filter((record) => record.incident.source === source);

    const recentFailures = sameEvent.filter((record) => !record.result.success).length;

    return {
      similarEvents: sameSource.length,
      recentFailures,
      repeatDetected: sameEvent.length >= FrequencyAnalyzer.REPEAT_THRESHOLD,
      shouldThrottle: sameEvent.length >= FrequencyAnalyzer.THROTTLE_THRESHOLD,
    };
  }

  private getEventType(record: IncidentMemoryRecord): string {
    const originalType = record.incident.metadata?.originalType;
    return typeof originalType === 'string' && originalType.length > 0
      ? originalType
      : 'unknown';
  }
}
