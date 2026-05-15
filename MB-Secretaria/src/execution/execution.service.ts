import { Injectable, Logger } from '@nestjs/common';
import { ActionEnvelope, BrainDecision, GatedExecutionResult } from '../common/types/brain.types';
import { SAFE_COMMANDS } from './command.registry';
import { PowerShellExecutor } from './powershell.executor';

const MIN_EXECUTION_CONFIDENCE = 0.75;

function resolveAllowedActions(): ReadonlySet<string> {
  const raw = process.env.ALLOWED_ACTIONS ?? '';
  const entries = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set(entries.length > 0 ? entries : ['retry_with_backoff', 'reconcile_booking_slots']);
}

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);
  private readonly allowedActions: ReadonlySet<string>;

  constructor(private readonly powerShell: PowerShellExecutor) {
    this.allowedActions = resolveAllowedActions();
  }

  async gate(action: ActionEnvelope, decision: BrainDecision): Promise<GatedExecutionResult> {
    const autoRepairEnabled = process.env.ENABLE_AUTO_REPAIR === 'true';
    const entry = SAFE_COMMANDS[action.command];
    const rollbackHint = entry?.rollbackHint ?? 'none';

    // --- Gate 1: feature flag ---
    if (!autoRepairEnabled) {
      return this.simulated(action, 'ENABLE_AUTO_REPAIR is false — shadow mode', rollbackHint);
    }

    // --- Gate 2: action whitelist ---
    if (!this.allowedActions.has(action.command)) {
      return this.denied(action, `Action not in ALLOWED_ACTIONS whitelist: ${action.command}`, rollbackHint);
    }

    // --- Gate 3: registry tier check ---
    if (!entry || entry.tier === 'blocked' || !entry.enabled) {
      return this.denied(action, `Action blocked by registry policy: ${action.command}`, rollbackHint);
    }

    if (entry.tier === 'restricted' && !this.allowedActions.has(action.command)) {
      return this.denied(action, `Restricted action not explicitly allowlisted: ${action.command}`, rollbackHint);
    }

    // --- Gate 4: confidence threshold ---
    if (decision.confidence < MIN_EXECUTION_CONFIDENCE) {
      return this.denied(
        action,
        `Confidence ${decision.confidence} below execution threshold ${MIN_EXECUTION_CONFIDENCE}`,
        rollbackHint,
      );
    }

    // --- Execute ---
    return this.execute(action, rollbackHint);
  }

  private async execute(action: ActionEnvelope, rollbackHint: string): Promise<GatedExecutionResult> {
    try {
      this.logger.log(`[EXECUTING] ${action.command}`);
      const result = await this.powerShell.run(action);

      this.logger.log(`[EXECUTED] ${action.command} — success=${result.success}`);
      return {
        executed: true,
        reason: `Real execution completed`,
        output: result.details,
        error: null,
        simulated: false,
        rollbackHint,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[EXEC ERROR] ${action.command} — ${message}`);
      return {
        executed: false,
        reason: 'Execution failed',
        output: '',
        error: message,
        simulated: false,
        rollbackHint,
      };
    }
  }

  private simulated(action: ActionEnvelope, reason: string, rollbackHint: string): GatedExecutionResult {
    this.logger.log(`[SIMULATED] ${action.command} — ${reason}`);
    return { executed: false, reason, output: `SIMULATED: ${action.command}`, error: null, simulated: true, rollbackHint };
  }

  private denied(action: ActionEnvelope, reason: string, rollbackHint: string): GatedExecutionResult {
    this.logger.warn(`[DENIED] ${action.command} — ${reason}`);
    return { executed: false, reason, output: '', error: null, simulated: false, rollbackHint };
  }
}
