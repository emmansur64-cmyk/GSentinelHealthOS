import { Injectable } from '@nestjs/common';
import { exec } from 'node:child_process';
import { ActionEnvelope, ExecutionResult } from '../common/types/brain.types';
import { SAFE_COMMANDS } from './command.registry';

// C2: Static sealed allowlist of permitted command strings built at module load.
// No dynamic value can ever be passed to the shell — only these exact literals.
const PERMITTED_CMD_STRINGS: ReadonlySet<string> = new Set(
  Object.values(SAFE_COMMANDS).map((e) => e.cmd),
);

// C2: Reject any cmd that contains shell-dangerous metacharacters beyond what
// the known safe commands use. Written-output commands use spaces and quotes;
// docker/redis commands use spaces and dashes — nothing else is needed.
const SHELL_INJECTION_PATTERN = /[;&|`$(){}[\]<>\\]/;

@Injectable()
export class PowerShellExecutor {
  private failureCount = 0;

  private circuitOpenUntil = 0;

  private readonly maxFailures = 3;

  private readonly circuitCooldownMs = 30000;

  async run(action: ActionEnvelope): Promise<ExecutionResult> {
    if (Date.now() < this.circuitOpenUntil) {
      throw new Error('Execution circuit is open');
    }

    const entry = SAFE_COMMANDS[action.command];
    if (!entry) {
      throw new Error('Command not allowed');
    }

    if (!entry.enabled) {
      throw new Error('Command disabled');
    }

    // C2: Integrity seal — cmd must be one of the compile-time permitted strings
    if (!PERMITTED_CMD_STRINGS.has(entry.cmd)) {
      throw new Error('Command integrity check failed: not in permitted set');
    }

    // C2: Metacharacter guard — detect any shell injection even from registry entries
    if (SHELL_INJECTION_PATTERN.test(entry.cmd)) {
      throw new Error('Command integrity check failed: unsafe metacharacters detected');
    }

    try {
      const output = await this.runCommand(entry.cmd);
      this.failureCount = 0;

      return {
        success: true,
        action: action.command,
        details: output.trim() || 'Command executed',
        rollbackSuggested: false,
      };
    } catch (error) {
      this.failureCount += 1;
      if (this.failureCount >= this.maxFailures) {
        this.circuitOpenUntil = Date.now() + this.circuitCooldownMs;
      }

      throw error;
    }
  }

  private runCommand(cmd: string): Promise<string> {
    // C4: Single settled flag prevents double-reject from dual timeout sources.
    return new Promise((resolve, reject) => {
      let settled = false;

      const settle = (fn: () => void): void => {
        if (settled) return;
        settled = true;
        fn();
      };

      const child = exec(
        `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${cmd.replace(/"/g, '\\"')}"`,
        { timeout: 5000, windowsHide: true },
        (err, stdout, stderr) => {
          if (err) {
            settle(() => reject(new Error(stderr?.trim() || err.message)));
            return;
          }
          settle(() => resolve(stdout));
        },
      );

      // C4: Backup hard-kill at 5500ms — only fires if exec timeout (5000ms) did not settle first
      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        settle(() => reject(new Error('Command timeout')));
      }, 5500);

      child.on('exit', () => clearTimeout(timer));
    });
  }
}
