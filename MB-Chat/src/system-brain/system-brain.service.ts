import { Injectable, Optional } from '@nestjs/common';
import { CommandId, ErrorFingerprint, IncidentPayload } from '../common/types/brain.types';
import { LearningService } from '../learning/learning.service';
import { MemoryService } from '../memory/memory.service';
import { FrequencyAnalyzer } from './analyzers/frequency.analyzer';
import { PatternAnalyzer } from './analyzers/pattern.analyzer';

export interface EnrichedDiagnosis {
  diagnosis: ErrorFingerprint;
  recentFailures: number;
  repeatDetected: boolean;
  shouldThrottle: boolean;
  shouldBlockAction: boolean;
  pattern: 'repeated_db_failure' | 'repeated_action_triggered' | 'none';
  repeatedAction: CommandId | null;
  weakActions: CommandId[];
  strongActions: CommandId[];
  actionRiskScore: number;
}

@Injectable()
export class SystemBrainService {
  private static readonly MAX_MEMORY_SCAN = 100;
  private static readonly MIN_TIME_WINDOW_MS = 10 * 60 * 1000;

  constructor(
    private readonly memoryService: MemoryService,
    private readonly frequencyAnalyzer: FrequencyAnalyzer,
    private readonly patternAnalyzer: PatternAnalyzer,
    @Optional() private readonly learningService?: LearningService,
  ) {}

  process(diagnosis: ErrorFingerprint, event: IncidentPayload): EnrichedDiagnosis {
    const eventType = this.getEventType(event);
    const windowStart = Date.now() - SystemBrainService.MIN_TIME_WINDOW_MS;
    const recentRecords = this.memoryService
      .last(SystemBrainService.MAX_MEMORY_SCAN)
      .filter((r) => Date.parse(r.storedAt) >= windowStart);

    const frequency = this.frequencyAnalyzer.analyze(recentRecords, eventType, event.source);
    const pattern = this.patternAnalyzer.analyze(
      recentRecords,
      diagnosis.code,
      eventType,
      frequency.repeatDetected,
      frequency.recentFailures,
    );

    const insights = this.learningService?.getInsights() ?? {
      weakActions: [] as CommandId[],
      strongActions: [] as CommandId[],
      actionStats: {},
    };

    const actionRiskScore =
      (frequency.repeatDetected ? 2 : 0) +
      (frequency.recentFailures > 3 ? 1 : 0);

    return {
      diagnosis,
      recentFailures: frequency.recentFailures,
      repeatDetected: frequency.repeatDetected,
      shouldThrottle: frequency.shouldThrottle,
      shouldBlockAction: pattern.shouldBlockAction,
      pattern: pattern.pattern,
      repeatedAction: pattern.repeatedAction,
      weakActions: insights.weakActions,
      strongActions: insights.strongActions,
      actionRiskScore,
    };
  }

  private getEventType(event: IncidentPayload): string {
    const originalType = event.metadata?.originalType;
    return typeof originalType === 'string' && originalType.length > 0
      ? originalType
      : 'unknown';
  }
}
