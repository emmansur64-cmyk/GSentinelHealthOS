import { Injectable } from '@nestjs/common';
import { ActionEnvelope, BrainDecision } from '../common/types/brain.types';
import { SAFE_COMMANDS } from '../execution/command.registry';

const SYSTEM_COMMANDS = new Set<string>(['restart_postgres', 'restart_api']);

@Injectable()
export class ActionService {
  execute(decision: BrainDecision): ActionEnvelope {
    const command = SAFE_COMMANDS[decision.action];

    if (!command) {
      throw new Error('Command not allowed');
    }

    if (!command.enabled) {
      throw new Error('Command disabled');
    }

    if (command.risk === 'high' || command.tier === 'blocked') {
      throw new Error('High risk command blocked at Action layer');
    }

    return {
      type: SYSTEM_COMMANDS.has(decision.action) ? 'SYSTEM' : 'BUSINESS',
      command: decision.action,
      payload: {},
    };
  }
}
