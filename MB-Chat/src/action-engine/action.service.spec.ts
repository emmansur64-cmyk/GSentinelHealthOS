import { describe, expect, it } from '@jest/globals';
import { BrainDecision } from '../common/types/brain.types';
import { ActionService } from './action.service';

describe('ActionService execution security contracts', () => {
  it('bloquea comando no registrado', () => {
    const service = new ActionService();

    const decision = {
      strategy: 'error',
      action: 'not_registered_command',
      confidence: 0.99,
      reason: 'test invalid command',
    } as unknown as BrainDecision;

    expect(() => service.execute(decision)).toThrow('Command not allowed');
  });

  it('bloquea comando high risk desde Action layer', () => {
    const service = new ActionService();

    const decision: BrainDecision = {
      strategy: 'error',
      action: 'clear_cache',
      confidence: 0.95,
      reason: 'test high risk',
    };

    expect(() => service.execute(decision)).toThrow('Command disabled');
  });

  it('devuelve accion de tipo SYSTEM para restart_api', () => {
    const service = new ActionService();

    const decision: BrainDecision = {
      strategy: 'error',
      action: 'restart_api',
      confidence: 0.95,
      reason: 'test system action',
    };

    const action = service.execute(decision);

    expect(action.type).toBe('SYSTEM');
    expect(action.command).toBe('restart_api');
  });
});
