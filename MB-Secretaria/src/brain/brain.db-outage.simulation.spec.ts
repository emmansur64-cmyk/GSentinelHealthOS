/**
 * Simulation: Real Database Outage Scenario
 *
 * Sends 10 consecutive incidents mimicking a postgres ECONNREFUSED storm.
 * Validates: no crashes, anti-repeat protection, rate limiting, audit coverage.
 */
import { describe, beforeAll, it, expect } from '@jest/globals';
import { BrainService } from './brain.service';
import { GuardService } from '../guard/guard.service';
import { AuditService } from '../audit/audit.service';
import { MemoryService } from '../memory/memory.service';
import { ActionService } from '../action-engine/action.service';
import { ExecutionService } from '../execution/execution.service';
import { EventProducer } from '../events/producer/event.producer';
import { BrainRouter } from './brain.router';
import { BookingStrategy } from './strategies/booking.strategy';
import { ScheduleStrategy } from './strategies/schedule.strategy';
import { ErrorStrategy } from './strategies/error.strategy';
import { BookingRules } from '../guard/rules/booking.rules';
import { DataRules } from '../guard/rules/data.rules';
import { SafetyRules } from '../guard/rules/safety.rules';
import { BookingValidator } from '../guard/validators/booking.validator';
import { ScheduleValidator } from '../guard/validators/schedule.validator';
import { IncidentResult } from '../common/types/brain.types';

// ── Lightweight stubs for external dependencies ──────────────────────────────

const aiServiceStub = {
  suggestEnhancement: async () => 'AI stub: monitor db connectivity',
  analyze: async () => ({ rootCause: 'db_unreachable', confidence: 0.9, source: 'stub' }),
};

const powerShellStub = {
  run: async () => ({ success: true, action: 'retry_with_backoff', details: 'stub', rollbackSuggested: false }),
};

const persistenceStub = {
  saveAudit: async () => undefined,
  saveIncident: async () => undefined,
  saveDecision: async () => undefined,
  saveFeatures: async () => undefined,
  fireAndForget: () => undefined,
};

// ── DB outage payload factory ────────────────────────────────────────────────

function buildDbOutagePayload(index: number) {
  return {
    id: `outage-sim-${index}-${Date.now()}`,
    type: 'system.error',
    source: 'postgres',
    timestamp: new Date().toISOString(),
    logs: [
      'Error: connect ECONNREFUSED 127.0.0.1:5432',
      'connection failed',
      'timeout acquiring client',
    ],
    metrics: {
      db_latency_ms: 15000,
      db_connections: 0,
      error_rate: 0.9,
    },
  };
}

// ── Wire services ─────────────────────────────────────────────────────────────

function buildBrainService(): { brain: BrainService; audit: AuditService } {
  const bookingRules = new BookingRules();
  const dataRules = new DataRules();
  const safetyRules = new SafetyRules();
  const bookingValidator = new BookingValidator();
  const scheduleValidator = new ScheduleValidator();

  const guardService = new GuardService(
    bookingRules,
    dataRules,
    safetyRules,
    bookingValidator,
    scheduleValidator,
  );

  const auditService = new AuditService(persistenceStub as never);
  const memoryService = new MemoryService(persistenceStub as never);
  const actionService = new ActionService();
  const executionService = new ExecutionService(powerShellStub as never);
  const eventProducer = new EventProducer();
  const router = new BrainRouter();
  const bookingStrategy = new BookingStrategy();
  const scheduleStrategy = new ScheduleStrategy();
  const errorStrategy = new ErrorStrategy();

  const brain = new BrainService(
    guardService,
    aiServiceStub as never,
    actionService,
    auditService,
    memoryService,
    executionService,
    eventProducer,
    router,
    bookingStrategy,
    scheduleStrategy,
    errorStrategy,
  );

  return { brain, audit: auditService };
}

// ── Simulation ────────────────────────────────────────────────────────────────

describe('DB Outage Simulation — 10 consecutive incidents', () => {
  const INCIDENT_COUNT = 10;
  const results: IncidentResult[] = [];
  let auditService: AuditService;
  let crashes = 0;

  beforeAll(async () => {
    const { brain, audit } = buildBrainService();
    auditService = audit;

    for (let i = 1; i <= INCIDENT_COUNT; i++) {
      const payload = buildDbOutagePayload(i);
      try {
        const result = await brain.processIncident({
          id: payload.id,
          source: payload.source,
          message: payload.logs[0],
          timestamp: payload.timestamp,
          metadata: {
            logs: payload.logs,
            metrics: payload.metrics,
            originalType: payload.type,
          },
        });
        results.push(result);
      } catch {
        crashes++;
        results.push({
          status: 'FALLBACK',
          action: '',
          reason: 'unhandled crash',
          execution: null,
          meta: { incidentId: payload.id },
        });
      }
    }
  });

  // ── Contract: no crashes ────────────────────────────────────────────────────
  it('no debe arrojar excepciones no manejadas (crashes = 0)', () => {
    expect(crashes).toBe(0);
  });

  // ── Contract: all incidents processed ──────────────────────────────────────
  it('debe procesar los 10 incidentes sin omitir ninguno', () => {
    expect(results).toHaveLength(INCIDENT_COUNT);
  });

  // ── Contract: structured response on every incident ─────────────────────────
  it('cada respuesta debe tener estructura valida (status + action + reason)', () => {
    for (const r of results) {
      expect(r).toHaveProperty('status');
      expect(r).toHaveProperty('action');
      expect(r).toHaveProperty('reason');
      expect(r).toHaveProperty('execution');
      expect(r).toHaveProperty('meta');

      const validStatuses = ['SUCCESS', 'EXECUTED', 'SIMULATED', 'BLOCKED', 'FALLBACK'];
      expect(validStatuses).toContain(r.status);
    }
  });

  // ── Contract: anti-repeat / no execution storms ─────────────────────────────
  it('no debe ejecutar comandos reales en cascada (execution_attempts = 0)', () => {
    const realExecutions = results.filter(
      (r) => r.execution !== null && r.execution.executed === true && r.execution.simulated === false,
    );
    expect(realExecutions).toHaveLength(0);
  });

  // ── Contract: BLOCKED or SIMULATED — no unbounded loops ────────────────────
  it('todos los incidentes deben ser BLOCKED o SIMULATED (anti-loop proof)', () => {
    for (const r of results) {
      expect(['BLOCKED', 'SIMULATED']).toContain(r.status);
    }
  });

  // ── Contract: audit log for every incident ──────────────────────────────────
  it('debe registrar audit entry por cada incidente procesado', () => {
    const auditEntries = auditService.findAll();
    expect(auditEntries.length).toBeGreaterThanOrEqual(INCIDENT_COUNT);
  });

  // ── Contract: blocked count ──────────────────────────────────────────────────
  it('blocked_count debe ser >= 1 (proteccion activa)', () => {
    const blockedCount = results.filter((r) => r.status === 'BLOCKED').length;
    expect(blockedCount).toBeGreaterThanOrEqual(1);
  });

  // ── Summary report ───────────────────────────────────────────────────────────
  it('emite resumen de simulacion con todos los metricas esperados', () => {
    const blockedCount = results.filter((r) => r.status === 'BLOCKED').length;
    const simulatedCount = results.filter((r) => r.status === 'SIMULATED').length;
    const executionAttempts = results.filter(
      (r) => r.execution !== null && (r.execution.executed || r.execution.simulated),
    ).length;

    const uniqueActions = new Set(results.map((r) => r.action).filter(Boolean));
    const loopsDetected =
      uniqueActions.size === 1 &&
      executionAttempts > 3 &&
      results.every((r) => r.action === [...uniqueActions][0]);

    const stability = crashes === 0 && !loopsDetected ? 'OK' : 'DEGRADED';

    const summary = {
      loops_detected: loopsDetected,
      crashes,
      execution_attempts: executionAttempts,
      blocked_count: blockedCount,
      simulated_count: simulatedCount,
      stability,
    };

    // Print for visibility
    console.log('\n=== DB OUTAGE SIMULATION SUMMARY ===');
    console.log(JSON.stringify(summary, null, 2));
    console.log('=====================================\n');

    // Verify summary fields are present and coherent
    expect(summary.crashes).toBe(0);
    expect(summary.blocked_count + summary.simulated_count).toBe(INCIDENT_COUNT);
    expect(summary.stability).toBe('OK');
    expect(typeof summary.loops_detected).toBe('boolean');
  });
});
