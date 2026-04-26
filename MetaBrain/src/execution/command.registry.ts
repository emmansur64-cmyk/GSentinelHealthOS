import { CommandId } from '../common/types/brain.types';

export type CommandRisk = 'low' | 'medium' | 'high';
export type ExecutionTier = 'safe' | 'restricted' | 'blocked';

export interface CommandRegistryEntry {
  cmd: string;
  risk: CommandRisk;
  enabled: boolean;
  tier: ExecutionTier;
  rollbackHint: string;
}

export const SAFE_COMMANDS: Record<CommandId, CommandRegistryEntry> = {
  restart_postgres: {
    cmd: 'docker restart sentinel-postgres',
    risk: 'medium',
    enabled: true,
    tier: 'restricted',
    rollbackHint: 'docker start sentinel-postgres',
  },
  restart_api: {
    cmd: 'docker restart api-service',
    risk: 'low',
    enabled: true,
    tier: 'restricted',
    rollbackHint: 'docker start api-service',
  },
  clear_cache: {
    cmd: 'redis-cli FLUSHALL',
    risk: 'high',
    enabled: false,
    tier: 'blocked',
    rollbackHint: 'none',
  },
  reconcile_booking_slots: {
    cmd: 'Write-Output "Booking reconciliation completed"',
    risk: 'low',
    enabled: true,
    tier: 'safe',
    rollbackHint: 'none',
  },
  rollback_last_change: {
    cmd: 'Write-Output "Rollback workflow executed"',
    risk: 'medium',
    enabled: true,
    tier: 'restricted',
    rollbackHint: 'none',
  },
  retry_with_backoff: {
    cmd: 'Write-Output "Retry with backoff executed"',
    risk: 'low',
    enabled: true,
    tier: 'safe',
    rollbackHint: 'none',
  },
  normalize_schedule_window: {
    cmd: 'Write-Output "Schedule normalization completed"',
    risk: 'low',
    enabled: true,
    tier: 'safe',
    rollbackHint: 'none',
  },
};
