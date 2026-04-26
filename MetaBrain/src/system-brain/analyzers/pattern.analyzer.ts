import { Injectable } from '@nestjs/common';
import { CommandId } from '../../common/types/brain.types';
import { IncidentMemoryRecord } from '../../memory/schemas/incidents.schema';

export interface PatternAnalysis {
  pattern: 'repeated_db_failure' | 'repeated_action_triggered' | 'none';
  repeatedAction: CommandId | null;
  shouldBlockAction: boolean;
}

@Injectable()
export class PatternAnalyzer {
  analyze(
    recentRecords: IncidentMemoryRecord[],
    diagnosisCode: string,
    eventType: string,
    repeatDetected: boolean,
    recentFailures: number,
  ): PatternAnalysis {
    if (diagnosisCode === 'DB_CONNECTION_TIMEOUT' && repeatDetected) {
      return {
        pattern: 'repeated_db_failure',
        repeatedAction: this.findMostRepeatedAction(recentRecords, eventType),
        shouldBlockAction: false,
      };
    }

    const repeatedAction = this.findMostRepeatedAction(recentRecords, eventType);
    const sameEventCount = recentRecords.filter((record) => this.getEventType(record) === eventType).length;

    if (sameEventCount >= 3 && repeatedAction !== null && recentFailures >= 2) {
      return {
        pattern: 'repeated_action_triggered',
        repeatedAction,
        shouldBlockAction: true,
      };
    }

    return {
      pattern: 'none',
      repeatedAction: null,
      shouldBlockAction: false,
    };
  }

  private findMostRepeatedAction(
    recentRecords: IncidentMemoryRecord[],
    eventType: string,
  ): CommandId | null {
    const actionCounter = new Map<CommandId, number>();

    for (const record of recentRecords) {
      if (this.getEventType(record) !== eventType) {
        continue;
      }

      const current = actionCounter.get(record.decision.action) ?? 0;
      actionCounter.set(record.decision.action, current + 1);
    }

    let mostRepeated: CommandId | null = null;
    let maxCount = 0;

    for (const [action, count] of actionCounter.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostRepeated = action;
      }
    }

    if (maxCount < 2) {
      return null;
    }

    return mostRepeated;
  }

  private getEventType(record: IncidentMemoryRecord): string {
    const originalType = record.incident.metadata?.originalType;
    return typeof originalType === 'string' && originalType.length > 0
      ? originalType
      : 'unknown';
  }
}
