import { Injectable } from '@nestjs/common';
import { CommandId, IncidentPayload, MlPredictionTrace } from '../../common/types/brain.types';

export interface OutcomeRecord {
  incidentId?: string;
  action: CommandId;
  outcome: 'success' | 'failure' | 'blocked' | 'simulated';
  input?: IncidentPayload;
  prediction?: MlPredictionTrace;
  realResult?: {
    executed: boolean;
    simulated: boolean;
    reason: string;
    output: string;
    error: string | null;
  };
  recordedAt: string;
}

export interface ActionEffectiveness {
  action: CommandId;
  total: number;
  successRate: number;
  failureRate: number;
  lastUsed: string;
  isWeak: boolean;
}

@Injectable()
export class ActionEffectivenessAnalyzer {
  private static readonly WEAK_FAILURE_RATE = 0.6;
  private static readonly WEAK_MIN_TOTAL = 3;
  /**
   * Exponential decay half-life (2 hours).
   * weight = exp(-age_ms / DECAY_MS)
   * Records far in the past contribute very little rather than being hard-cut.
   */
  private static readonly DECAY_MS = 2 * 60 * 60 * 1000; // 2 hours

  /** w = exp(-age / τ) — returns [0, 1], older records weigh less */
  private decayWeight(recordedAt: string): number {
    const ageMs = Date.now() - Date.parse(recordedAt);
    if (!Number.isFinite(ageMs) || ageMs < 0) return 0;
    return Math.exp(-ageMs / ActionEffectivenessAnalyzer.DECAY_MS);
  }

  compute(records: OutcomeRecord[]): ActionEffectiveness[] {
    const grouped = new Map<CommandId, OutcomeRecord[]>();

    for (const record of records) {
      const existing = grouped.get(record.action) ?? [];
      existing.push(record);
      grouped.set(record.action, existing);
    }

    const result: ActionEffectiveness[] = [];

    for (const [action, actionRecords] of grouped.entries()) {
      // H5: Exclude 'blocked' and 'simulated' — counting them as failures would
      // create a self-reinforcing degradation loop.
      const meaningful = actionRecords.filter(
        (r) => r.outcome === 'success' || r.outcome === 'failure',
      );

      // Exponential time-decay weighted sums
      let weightedSuccesses = 0;
      let weightedFailures = 0;
      let totalWeight = 0;

      for (const r of meaningful) {
        const w = this.decayWeight(r.recordedAt);
        totalWeight += w;
        if (r.outcome === 'success') weightedSuccesses += w;
        else weightedFailures += w;
      }

      const successRate = totalWeight > 0 ? weightedSuccesses / totalWeight : 0;
      const failureRate = totalWeight > 0 ? weightedFailures / totalWeight : 0;
      // total = unweighted count for the isWeak minimum-sample guard
      const total = meaningful.length;

      const sorted = actionRecords
        .slice()
        .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
      const lastUsed = sorted[0]?.recordedAt ?? new Date().toISOString();

      const isWeak =
        failureRate > ActionEffectivenessAnalyzer.WEAK_FAILURE_RATE &&
        total > ActionEffectivenessAnalyzer.WEAK_MIN_TOTAL;

      result.push({ action, total, successRate, failureRate, lastUsed, isWeak });
    }

    return result;
  }
}

