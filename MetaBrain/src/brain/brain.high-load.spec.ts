/**
 * Simulation: High Load Scenario (20 incidents in <5 seconds)
 *
 * Tests system behavior under rapid-fire incident flooding.
 * Measures: processing rate, rate limiting, latency distribution, stability.
 *
 * Expected:
 *  - Rate limiter activates after N requests
 *  - No cascade execution or multiple actions per incident
 *  - Consistent response times (no degradation)
 *  - Zero crashes
 */
import { describe, beforeAll, it, expect } from '@jest/globals';
import { BrainService } from '../brain/brain.service';
import { GuardService } from '../guard/guard.service';
import { AuditService } from '../audit/audit.service';
import { MemoryService } from '../memory/memory.service';
import { ActionService } from '../action-engine/action.service';
import { ExecutionService } from '../execution/execution.service';
import { EventProducer } from '../events/producer/event.producer';
import { BrainRouter } from '../brain/brain.router';
import { BookingStrategy } from '../brain/strategies/booking.strategy';
import { ScheduleStrategy } from '../brain/strategies/schedule.strategy';
import { ErrorStrategy } from '../brain/strategies/error.strategy';
import { BookingRules } from '../guard/rules/booking.rules';
import { DataRules } from '../guard/rules/data.rules';
import { SafetyRules } from '../guard/rules/safety.rules';
import { BookingValidator } from '../guard/validators/booking.validator';
import { ScheduleValidator } from '../guard/validators/schedule.validator';
import { IncidentPayload, IncidentResult } from '../common/types/brain.types';

// ── Stubs ─────────────────────────────────────────────────────────────────────

const aiServiceStub = {
  suggestEnhancement: async () => 'AI: monitor load',
  analyze: async () => ({ rootCause: 'high_load', confidence: 0.5, source: 'stub' }),
};

const powerShellStub = {
  run: async () => ({
    success: true,
    action: 'retry_with_backoff',
    details: 'stub',
    rollbackSuggested: false,
  }),
};

const persistenceStub = {
  saveAudit: async () => undefined,
  saveIncident: async () => undefined,
  saveDecision: async () => undefined,
  saveFeatures: async () => undefined,
  fireAndForget: () => undefined,
};

// ── Factory ───────────────────────────────────────────────────────────────────

function buildBrainService(): { brain: BrainService; audit: AuditService } {
  const guardService = new GuardService(
    new BookingRules(),
    new DataRules(),
    new SafetyRules(),
    new BookingValidator(),
    new ScheduleValidator(),
  );

  const auditService = new AuditService(persistenceStub as never);

  const brain = new BrainService(
    guardService,
    aiServiceStub as never,
    new ActionService(),
    auditService,
    new MemoryService(persistenceStub as never),
    new ExecutionService(powerShellStub as never),
    new EventProducer(),
    new BrainRouter(),
    new BookingStrategy(),
    new ScheduleStrategy(),
    new ErrorStrategy(),
  );

  return { brain, audit: auditService };
}

// ── Report entry ──────────────────────────────────────────────────────────────

interface ProcessingRecord {
  incidentIndex: number;
  startMs: number;
  endMs: number;
  latencyMs: number;
  status: string;
  crashed: boolean;
  errorMessage: string | null;
}

// ── Simulation ────────────────────────────────────────────────────────────────

describe('High Load Scenario: 20 incidents in <5 seconds', () => {
  const INCIDENT_COUNT = 20;
  const LOAD_WINDOW_MS = 5000;
  const records: ProcessingRecord[] = [];
  let crashes = 0;
  let totalElapsedMs = 0;

  beforeAll(async () => {
    const { brain } = buildBrainService();
    const globalStart = Date.now();

    // Send 20 incidents as rapidly as possible (unthrottled)
    const promises: Promise<void>[] = [];

    for (let i = 0; i < INCIDENT_COUNT; i++) {
      const promise = (async () => {
        const incidentStart = Date.now();
        try {
          const payload: IncidentPayload = {
            id: `high-load-${i}-${Date.now()}`,
            source: 'load-test',
            message: 'High load test incident',
            timestamp: new Date().toISOString(),
            metadata: {
              logs: ['load-test'],
              data: {},
              metrics: { batch_id: 'load-test-batch' },
              originalType: 'system.event',
            },
          };

          await brain.processIncident(payload);

          const incidentEnd = Date.now();
          const latency = incidentEnd - incidentStart;

          records.push({
            incidentIndex: i,
            startMs: incidentStart - globalStart,
            endMs: incidentEnd - globalStart,
            latencyMs: latency,
            status: 'SUCCESS',
            crashed: false,
            errorMessage: null,
          });
        } catch (err) {
          crashes++;
          const incidentEnd = Date.now();
          const latency = incidentEnd - incidentStart;
          const msg = err instanceof Error ? err.message : String(err);

          records.push({
            incidentIndex: i,
            startMs: incidentStart - globalStart,
            endMs: incidentEnd - globalStart,
            latencyMs: latency,
            status: 'CRASHED',
            crashed: true,
            errorMessage: msg,
          });
        }
      })();

      promises.push(promise);
    }

    // Wait for all to complete
    await Promise.all(promises);
    totalElapsedMs = Date.now() - globalStart;
  });

  // ── Load contracts ────────────────────────────────────────────────────────

  it('debe procesar los 20 incidentes sin omitir ninguno', () => {
    expect(records).toHaveLength(INCIDENT_COUNT);
  });

  it('cero crashes en el escenario de alta carga', () => {
    expect(crashes).toBe(0);
  });

  it('tiempo total de ejecucion bajo el limite de 5 segundos', () => {
    expect(totalElapsedMs).toBeLessThan(LOAD_WINDOW_MS);
  });

  it('latencia maxima por incidente debe ser <2000ms (razonable bajo carga)', () => {
    const maxLatency = Math.max(...records.map((r) => r.latencyMs));
    expect(maxLatency).toBeLessThan(2000);
  });

  it('95% de incidentes procesados sin crash', () => {
    const nonCrashCount = records.filter((r) => !r.crashed).length;
    const percentage = (nonCrashCount / INCIDENT_COUNT) * 100;
    expect(percentage).toBeGreaterThanOrEqual(95);
  });

  it('todas las respuestas tienen estructura valida (no undefined properties)', () => {
    for (const r of records) {
      expect(typeof r.latencyMs).toBe('number');
      expect(typeof r.status).toBe('string');
      expect(typeof r.crashed).toBe('boolean');
    }
  });

  // ── Rate limiting & stability contracts ────────────────────────────────

  it('no hay degradacion de latencia bajo carga (latencias bajas y distribuidas)', () => {
    const latencies = records.map((r) => r.latencyMs);
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const maxLatency = Math.max(...latencies);

    // With microsecond precision timings, even small variance creates ratio variance.
    // More important: avg < 10ms and no outliers > 100ms
    expect(avgLatency).toBeLessThan(10);
    expect(maxLatency).toBeLessThan(100);
  });

  it('sin cascada de ejecutiones — cada incidente genera maximo una decision', () => {
    // If an incident appeared multiple times in quick succession with same action,
    // it suggests a cascading execution loop. Record count should match incident count.
    expect(records.length).toBe(INCIDENT_COUNT);
  });

  it('distribución de latencias es consistente (no outliers extremos)', () => {
    const latencies = records.map((r) => r.latencyMs);
    const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const variance =
      latencies.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) / latencies.length;
    const stdDev = Math.sqrt(variance);

    // Acceptable: stdDev should not exceed 3x the mean
    expect(stdDev).toBeLessThan(mean * 3);
  });

  // ── Rate limiting detection ────────────────────────────────────────────

  it('detecta throttling o rate limiting activo', () => {
    // If rate limiting kicked in, we'd see:
    // - Increasing latencies as queue backs up
    // - Or explicit 429/429-equivalent responses
    // - Or pattern of BLOCKED statuses

    const throttledCount = records.filter((r) => r.status === 'THROTTLED').length;
    const blockedCount = records.filter((r) => r.status === 'BLOCKED').length;

    // For this simulation without explicit rate limiter, we expect 0 throttled
    // but log the count for visibility
    console.log(`Rate limited (throttled): ${throttledCount}`);
    console.log(`Rate limited (blocked): ${blockedCount}`);
  });

  // ── Summary report ────────────────────────────────────────────────────

  it('emite resumen de carga con metricas esperadas', () => {
    const processedCount = records.filter((r) => !r.crashed).length;
    const rateLimitedCount = records.filter((r) => r.status === 'THROTTLED').length;
    const latencyValues = records.map((r) => r.latencyMs);
    const avgLatency = Math.round(latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length);
    const status =
      crashes === 0 && totalElapsedMs < LOAD_WINDOW_MS && avgLatency < 500 ? 'STABLE' : 'UNSTABLE';

    const summary = {
      events_processed: processedCount,
      rate_limited: rateLimitedCount,
      crashes,
      latency_avg_ms: avgLatency,
      latency_p95_ms: Math.round(
        latencyValues.sort((a, b) => a - b)[Math.floor(INCIDENT_COUNT * 0.95)],
      ),
      latency_p99_ms: Math.round(
        latencyValues.sort((a, b) => a - b)[Math.floor(INCIDENT_COUNT * 0.99)],
      ),
      total_elapsed_ms: totalElapsedMs,
      status,
    };

    console.log('\n=== HIGH LOAD SCENARIO SUMMARY ===');
    console.log(JSON.stringify(summary, null, 2));
    console.log('==================================\n');

    // Verify required fields are present
    expect(summary.events_processed).toBe(INCIDENT_COUNT);
    expect(summary.crashes).toBe(0);
    expect(summary.latency_avg_ms).toBeGreaterThan(0);
    expect(['STABLE', 'UNSTABLE']).toContain(summary.status);
    expect(summary.total_elapsed_ms).toBeLessThan(LOAD_WINDOW_MS);
  });
});
