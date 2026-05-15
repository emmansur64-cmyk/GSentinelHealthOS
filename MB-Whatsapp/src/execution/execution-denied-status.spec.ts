import { ActionService } from '../action-engine/action.service';
import { AiService } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import { BrainService } from '../brain/brain.service';
import { BrainRouter } from '../brain/brain.router';
import { BookingStrategy } from '../brain/strategies/booking.strategy';
import { ErrorStrategy } from '../brain/strategies/error.strategy';
import { ScheduleStrategy } from '../brain/strategies/schedule.strategy';
import { IncidentPayload } from '../common/types/brain.types';
import { EventProducer } from '../events/producer/event.producer';
import { ExecutionService } from './execution.service';

describe('execution denied status mapping', () => {
  const previousEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...previousEnv };
  });

  it('ExecutionService.denied returns not executed and not simulated', async () => {
    process.env.ENABLE_AUTO_REPAIR = 'true';
    process.env.ALLOWED_ACTIONS = 'retry_with_backoff';

    const service = new ExecutionService({ run: jest.fn() } as never);
    const result = await service.gate(
      { type: 'SYSTEM', command: 'restart_postgres', payload: {} },
      {
        strategy: 'error',
        action: 'restart_postgres',
        confidence: 0.99,
        reason: 'db outage',
      },
    );

    expect(result.executed).toBe(false);
    expect(result.simulated).toBe(false);
    expect(result.reason).toContain('whitelist');
  });

  it('BrainService reports BLOCKED instead of SUCCESS for denied execution', async () => {
    process.env.ENABLE_AUTO_REPAIR = 'true';
    process.env.ALLOWED_ACTIONS = 'retry_with_backoff';

    const payload: IncidentPayload = {
      id: 'denied-status-1',
      source: 'postgres',
      message: 'connection timeout',
      timestamp: new Date().toISOString(),
      metadata: {},
    };

    const persistence = {
      saveAudit: jest.fn(),
      saveIncident: jest.fn(),
      saveDecision: jest.fn(),
      saveFeatures: jest.fn(),
      updateOnlineTrainingOutcome: jest.fn().mockResolvedValue(undefined),
      saveOnlineTrainingRecord: jest.fn().mockResolvedValue(undefined),
      fireAndForget: jest.fn(),
    };

    const service = new BrainService(
      { validate: jest.fn(() => ({ allowed: true, reasons: [], normalizedInput: payload })), validateDecision: jest.fn(() => ({ allowed: true, reasons: [] })) } as never,
      { suggestEnhancement: jest.fn().mockResolvedValue('watch database') } as unknown as AiService,
      new ActionService(),
      new AuditService(persistence as never),
      { rememberIncident: jest.fn() } as never,
      new ExecutionService({ run: jest.fn() } as never),
      { publish: jest.fn().mockResolvedValue({ event_id: 'evt', trace_id: 'trace' }) } as unknown as EventProducer,
      { route: jest.fn(() => 'error') } as unknown as BrainRouter,
      { decide: jest.fn() } as unknown as BookingStrategy,
      { decide: jest.fn() } as unknown as ScheduleStrategy,
      {
        decide: jest.fn(() => ({
          strategy: 'error',
          action: 'restart_postgres',
          confidence: 0.99,
          reason: 'restart postgres',
        })),
      } as unknown as ErrorStrategy,
      {
        predictDecision: jest.fn().mockResolvedValue({
          action: 'restart_postgres',
          confidence: 0.2,
          modelUsed: false,
          source: 'RULES',
          inferenceMs: 0,
          featureVector: [],
        }),
        getDecisionThresholds: jest.fn(() => ({ hybridMin: 0.7 })),
        getModelVersion: jest.fn(() => 'test'),
        getFeatureBuilder: jest.fn(() => ({ getFeatureNames: () => [] })),
      } as never,
      persistence as never,
    );

    const result = await service.processIncident(payload);

    expect(result.status).toBe('BLOCKED');
    expect(result.execution?.executed).toBe(false);
    expect(result.execution?.simulated).toBe(false);
    expect(result.meta.denied).toBe(true);
    expect(result.meta.operational_success).toBe(false);
  });
});
