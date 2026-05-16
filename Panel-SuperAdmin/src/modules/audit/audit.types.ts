export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'TENANT_CREATE'
  | 'TENANT_UPDATE'
  | 'TENANT_SUSPEND'
  | 'TENANT_ACTIVATE'
  | 'PROVIDER_CONFIG_UPDATE'
  | 'FLAG_TOGGLE'
  | 'SYSTEM_HEALTH_CHECK'
  | 'CONFIG_UPDATE'

export interface AuditActor {
  id: string
  email: string
  role: string
}

export interface AuditTarget {
  type: string
  id: string
  name?: string
}

export interface AuditLogEntry {
  id: string
  action: AuditAction
  actor: AuditActor
  target?: AuditTarget
  details?: Record<string, unknown>
  ip?: string
  requestId: string
  timestamp: string
}

export interface AuditLogFilters {
  action?: AuditAction
  actorId?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}
