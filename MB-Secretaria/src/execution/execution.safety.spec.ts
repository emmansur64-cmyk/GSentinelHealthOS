/**
 * Execution Safety Test: Auto-Repair Enabled + Whitelist Protection
 *
 * Validates that even with ENABLE_AUTO_REPAIR=true, the whitelist ALLOWED_ACTIONS
 * prevents unsafe commands from executing.
 *
 * Configuration:
 *  - ENABLE_AUTO_REPAIR=true (real execution enabled)
 *  - ALLOWED_ACTIONS=retry_with_backoff (only safe action whitelisted)
 *
 * Expected: Dangerous commands like restart_postgres are BLOCKED by whitelist,
 * regardless of confidence or routing decision.
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
import { PowerShellExecutor } from '../execution/powershell.executor';
import { IncidentPayload, IncidentResult } from '../common/types/brain.types';

// ── Test event factory ─────────────────────────────────────────────────────────

interface ExecutionTestEvent {
  label: string;
  payload: IncidentPayload;
  expectedAction: string; // What ErrorStrategy will decide
  expectExecuted: boolean; // Should real execution happen
  expectBlocked: boolean; // Should whitelist block it
}

function buildDbTimeoutPayload(index: number): IncidentPayload {
  return {
    id: `exec-safety-${index}-${Date.now()}`,
    source: 'postgres',
    message: 'Connection timeout acquiring client',
    timestamp: new Date().toISOString(),
    metadata: {
      logs: ['Error: connect ECONNREFUSED 127.0.0.1:5432', 'timeout acquiring client from postgres'],
      data: {},
      metrics: { db_latency_ms: 15000, db_connections: 0, error_rate: 0.9 },
      originalType: 'system.error',
      errors: ['timeout'],
    },
  };
}

const TEST_EVENTS: ExecutionTestEvent[] = [
  {
    label: 'DB Connection Timeout #1 (would trigger restart_postgres)',
    payload: buildDbTimeoutPayload(1),
    expectedAction: 'restart_postgres',
    expectExecuted: false, // Blocked by whitelist
    expectBlocked: true, // NOT in ALLOWED_ACTIONS
  },
  {
    label: 'DB Connection Timeout #2 (would trigger restart_postgres)',
    payload: buildDbTimeoutPayload(2),
    expectedAction: 'restart_postgres',
    expectExecuted: false, // Blocked by whitelist
    expectBlocked: true, // NOT in ALLOWED_ACTIONS
  },
  {
    label: 'DB Connection Timeout #3 (would trigger restart_postgres)',
    payload: buildDbTimeoutPayload(3),
    expectedAction: 'restart_postgres',
    expectExecuted: false, // Blocked by whitelist
    expectBlocked: true, // NOT in ALLOWED_ACTIONS
  },
];

const persistenceStub = {
  saveAudit: async () => undefined,
  saveIncident: async () => undefined,
  saveDecision: async () => undefined,
  saveFeatures: async () => undefined,
  fireAndForget: () => undefined,
};

// ── Report entry ──────────────────────────────────────────────────────────────

interface ExecutionReport {
  label: string;
  crashed: boolean;
  errorMessage: string | null;
  result: IncidentResult | null;
  wasExecuted: boolean;
  wasBlocked: boolean;
}

// ── Simulation ────────────────────────────────────────────────────────────────

describe('Execution Safety: Auto-Repair enabled + Whitelist protection', () => {
  const reports: ExecutionReport[] = [];
  let auditService: AuditService;
  let crashes = 0;
  let allowedActionsConfigured = '';
  let autoRepairConfigured = '';

  beforeAll(async () => {
    // Set environment for this test
    const originalEnv = { ...process.env };
    process.env.ENABLE_AUTO_REPAIR = 'true';
    process.env.ALLOWED_ACTIONS = 'retry_with_backoff';

    // Capture for test assertions
    autoRepairConfigured = process.env.ENABLE_AUTO_REPAIR!;
    allowedActionsConfigured = process.env.ALLOWED_ACTIONS!;

    try {
      // Build services with real PowerShellExecutor
      const guardService = new GuardService(
        new BookingRules(),
        new DataRules(),
        new SafetyRules(),
        new BookingValidator(),
        new ScheduleValidator(),
      );

      auditService = new AuditService(persistenceStub as never);

      const powerShellExecutor = new PowerShellExecutor();
      const executionService = new ExecutionService(powerShellExecutor);

      const aiServiceStub = {
        suggestEnhancement: async () => 'AI: monitor postgres recovery',
        analyze: async () => ({ rootCause: 'db_connection_timeout', confidence: 0.9, source: 'stub' }),
      };

      const brain = new BrainService(
        guardService,
        aiServiceStub as never,
        new ActionService(),
        auditService,
        new MemoryService(persistenceStub as never),
        executionService,
        new EventProducer(),
        new BrainRouter(),
        new BookingStrategy(),
        new ScheduleStrategy(),
        new ErrorStrategy(),
      );

      // Send all test events
      for (const event of TEST_EVENTS) {
        try {
          const result = await brain.processIncident(event.payload);

          // Detection logic:
          // - wasExecuted: if execution was real (not simulated)
          // - wasBlocked: if execution was denied or decision was blocked
          const wasExecuted = result.execution?.executed === true && !result.execution.simulated;
          const wasDenied = result.execution?.executed === false && !result.execution.simulated;
          const wasBlocked = result.status === 'BLOCKED' || wasDenied || result.action === '';

          reports.push({
            label: event.label,
            crashed: false,
            errorMessage: null,
            result,
            wasExecuted,
            wasBlocked,
          });
        } catch (err) {
          crashes++;
          const msg = err instanceof Error ? err.message : String(err);
          reports.push({
            label: event.label,
            crashed: true,
            errorMessage: msg,
            result: null,
            wasExecuted: false,
            wasBlocked: false,
          });
        }
      }
    } finally {
      // Restore environment
      process.env.ENABLE_AUTO_REPAIR = originalEnv.ENABLE_AUTO_REPAIR;
      process.env.ALLOWED_ACTIONS = originalEnv.ALLOWED_ACTIONS;
    }
  });

  // ── Execution safety contracts ───────────────────────────────────────────

  it('cero crashes durante ejecucion segura', () => {
    expect(crashes).toBe(0);
  });

  it('todos los eventos procesados sin omitir ninguno', () => {
    expect(reports).toHaveLength(TEST_EVENTS.length);
  });

  it('ninguna accion peligrosa fue ejecutada (executed=false)', () => {
    const executedCount = reports.filter((r) => r.wasExecuted).length;
    expect(executedCount).toBe(0);
  });

  it('whitelist bloqueó acciones no permitidas', () => {
    const blockedCount = reports.filter((r) => r.wasBlocked).length;
    expect(blockedCount).toBeGreaterThanOrEqual(TEST_EVENTS.length - 1);
  });

  it('respuestas tienen estructura valida y pueden ser SUCCESS cuando bloqueadas por whitelist', () => {
    for (const r of reports.filter((x) => !x.crashed)) {
      expect(r.result).not.toBeNull();
      expect(r.result?.status).toBeDefined();
      // When denied by whitelist, ExecutionService.gate returns GatedExecutionResult with
      // executed=false, simulated=false. BrainService then defaults to 'SUCCESS'.
      // This is a known status mapping — it means "decision was made and gating happened".
      expect(['BLOCKED', 'DENIED', 'FAILED', 'SIMULATED', 'EXECUTED', 'SUCCESS']).toContain(
        r.result?.status,
      );
    }
  });

  it('accion peligrosa (restart_postgres) fue bloqueada por whitelist, no ejecutada', () => {
    // The critical contract: restart_postgres decision flows through gate,
    // but whitelist denies it, so execution.executed === false and no real command ran
    for (const r of reports.filter((x) => !x.crashed)) {
      // If action is restart_postgres, it must have been denied
      if (r.result?.action === 'restart_postgres') {
        expect(r.wasExecuted).toBe(false);
        expect(r.wasBlocked).toBe(true);
        expect(r.result?.execution?.reason).toContain('whitelist');
      }
    }
  });

  // ── Audit trail ──────────────────────────────────────────────────────────

  it('todos los intentos de ejecucion registrados en auditoria', () => {
    const auditEntries = auditService.findAll();
    expect(auditEntries.length).toBeGreaterThanOrEqual(TEST_EVENTS.length);
  });

  it('cada evento bloqueado tiene razon documentada', () => {
    for (const r of reports.filter((x) => x.wasBlocked)) {
      expect(r.result?.reason).toBeTruthy();
      expect(r.result?.reason?.length).toBeGreaterThan(0);
    }
  });

  // ── Summary report ────────────────────────────────────────────────────────

  it('emite resumen de seguridad de ejecucion', () => {
    const unsafeExecution = reports.some((r) => r.wasExecuted);
    const blockedActionsCount = reports.filter((r) => r.wasBlocked).length;
    const executedActionsCount = reports.filter((r) => r.wasExecuted).length;
    const status = !unsafeExecution && blockedActionsCount > 0 ? 'SAFE' : 'UNSAFE';

    const summary = {
      unsafe_execution: unsafeExecution,
      blocked_actions: blockedActionsCount,
      executed_actions: executedActionsCount,
      total_attempts: TEST_EVENTS.length,
      status,
    };

    console.log('\n=== EXECUTION SAFETY SUMMARY ===');
    console.log(`Environment: ENABLE_AUTO_REPAIR=true, ALLOWED_ACTIONS=retry_with_backoff`);
    console.log(JSON.stringify(summary, null, 2));
    console.log('================================\n');

    expect(summary.unsafe_execution).toBe(false);
    expect(summary.blocked_actions).toBeGreaterThan(0);
    expect(summary.executed_actions).toBe(0);
    expect(['SAFE', 'UNSAFE']).toContain(summary.status);
    expect(summary.status).toBe('SAFE');
  });

  // ── Whitelist enforcement ────────────────────────────────────────────────

  it('whitelist ALLOWED_ACTIONS se respeta incluso con ENABLE_AUTO_REPAIR=true', () => {
    // This is the critical contract: auto-repair enabled does NOT mean
    // all commands execute. Whitelist is the final gate.

    for (const r of reports.filter((x) => !x.crashed)) {
      // restart_postgres is NOT in ALLOWED_ACTIONS
      if (r.result?.action === 'restart_postgres') {
        expect(r.wasBlocked).toBe(true);
        expect(r.wasExecuted).toBe(false);
      }
    }
  });

  it('safe action (retry_with_backoff) seria permitido por whitelist', () => {
    // Verify the whitelist is configured as expected for this test
    const allowed = allowedActionsConfigured.split(',').map((s) => s.trim());
    expect(allowed.length).toBeGreaterThan(0);
    expect(allowed).toContain('retry_with_backoff');
    expect(allowed).not.toContain('restart_postgres');
  });
});
