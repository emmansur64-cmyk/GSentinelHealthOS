/**
 * Cliente server-side para el backend FastAPI /api/v1/admin/panel/*.
 * SÓLO se usa en API routes de Next.js (Node.js runtime).
 * NUNCA importar desde Client Components — expone ADMIN_API_INTERNAL_KEY.
 */

import { appConfig } from '@/config/app.config'
import { apiFetch } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import type { Tenant, TenantUpdatePayload } from '@/modules/tenants/tenant.types'
import type { FeatureFlag } from '@/modules/feature-flags/flags.types'
import type { AuditLogEntry } from '@/modules/audit/audit.types'

const PANEL_BASE = `${appConfig.services.agendaApi}/api/v1/admin/panel`

function internalHeaders(): Record<string, string> {
  const key =
    process.env.ADMIN_API_INTERNAL_KEY?.trim() ||
    process.env.PANEL_ADMIN_API_KEY?.trim()
  if (!key) {
    throw new Error(
      'ADMIN_API_INTERNAL_KEY/PANEL_ADMIN_API_KEY is not set — required for Panel-SuperAdmin backend calls',
    )
  }
  return {
    'X-Internal-Key': key,
    'Content-Type': 'application/json',
  }
}

// ── Tenants ───────────────────────────────────────────────────────────────────

export interface BackendTenant {
  id: string
  name: string
  slug: string
  status: string
  plan: string
  created_at: string
  updated_at: string
}

function mapTenant(raw: BackendTenant): Tenant {
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    status: raw.status as Tenant['status'],
    plan: (raw.plan ?? 'basico') as Tenant['plan'],
    clinicCount: 0,
    userCount: 0,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  }
}

export async function listTenants(): Promise<Tenant[]> {
  const raw = await apiFetch<BackendTenant[]>(`${PANEL_BASE}/tenants`, {
    headers: internalHeaders(),
    timeoutMs: 10_000,
  })
  return raw.map(mapTenant)
}

export async function updateTenant(id: string, payload: TenantUpdatePayload): Promise<Tenant> {
  const raw = await apiFetch<BackendTenant>(`${PANEL_BASE}/tenants/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    headers: internalHeaders(),
    timeoutMs: 10_000,
  })
  return mapTenant(raw)
}

// ── Feature Flags ─────────────────────────────────────────────────────────────

interface BackendFlag {
  key: string
  label: string
  description: string | null
  enabled: boolean
  scope: string
  module: string | null
  updated_by: string | null
  updated_at: string
}

function mapFlag(raw: BackendFlag): FeatureFlag {
  return {
    key: raw.key,
    label: raw.label,
    description: raw.description ?? '',
    enabled: raw.enabled,
    scope: raw.scope as FeatureFlag['scope'],
    module: raw.module ?? '',
    updatedAt: raw.updated_at,
    updatedBy: raw.updated_by ?? undefined,
  }
}

export async function getFeatureFlags(): Promise<FeatureFlag[]> {
  const raw = await apiFetch<BackendFlag[]>(`${PANEL_BASE}/feature-flags`, {
    headers: internalHeaders(),
    timeoutMs: 8_000,
  })
  return raw.map(mapFlag)
}

export async function toggleFeatureFlag(
  key: string,
  enabled: boolean,
  updatedBy: string,
): Promise<FeatureFlag> {
  const raw = await apiFetch<BackendFlag>(`${PANEL_BASE}/feature-flags/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled, updated_by: updatedBy }),
    headers: internalHeaders(),
    timeoutMs: 8_000,
  })
  return mapFlag(raw)
}

// ── Audit Logs ────────────────────────────────────────────────────────────────

interface BackendAuditLog {
  id: string
  timestamp: string
  actor_id: string
  actor_email: string
  actor_role: string
  action: string
  resource_type: string | null
  resource_id: string | null
  status: string
  metadata_json: string | null
  request_id: string | null
}

interface AuditLogPage {
  logs: BackendAuditLog[]
  total: number
  page: number
  limit: number
}

function mapAuditLog(raw: BackendAuditLog): AuditLogEntry {
  return {
    id: raw.id,
    action: raw.action as AuditLogEntry['action'],
    actor: {
      id: raw.actor_id,
      email: raw.actor_email,
      role: raw.actor_role,
    },
    target: raw.resource_type
      ? { type: raw.resource_type, id: raw.resource_id ?? '', name: raw.resource_id ?? undefined }
      : undefined,
    requestId: raw.request_id ?? '',
    timestamp: raw.timestamp,
  }
}

export async function getAuditLogs(params?: {
  page?: number
  limit?: number
  action?: string
}): Promise<{ logs: AuditLogEntry[]; total: number; page: number; limit: number }> {
  const qs = new URLSearchParams()
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.action) qs.set('action', params.action)

  const url = `${PANEL_BASE}/audit-logs${qs.toString() ? `?${qs}` : ''}`
  const data = await apiFetch<AuditLogPage>(url, {
    headers: internalHeaders(),
    timeoutMs: 10_000,
  })

  return {
    logs: data.logs.map(mapAuditLog),
    total: data.total,
    page: data.page,
    limit: data.limit,
  }
}

export async function createAuditLog(entry: {
  actorId: string
  actorEmail: string
  actorRole: string
  action: string
  resourceType?: string
  resourceId?: string
  status?: string
  metadata?: Record<string, unknown>
  requestId?: string
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  // Non-blocking for main business flow, but failures are observable.
  try {
    await apiFetch(`${PANEL_BASE}/audit-logs`, {
      method: 'POST',
      body: JSON.stringify({
        actor_id: entry.actorId,
        actor_email: entry.actorEmail,
        actor_role: entry.actorRole,
        action: entry.action,
        resource_type: entry.resourceType,
        resource_id: entry.resourceId,
        status: entry.status ?? 'success',
        metadata_json: entry.metadata ? JSON.stringify(entry.metadata) : undefined,
        request_id: entry.requestId,
      }),
      headers: internalHeaders(),
      timeoutMs: 5_000,
    })
    return { ok: true }
  } catch (error) {
    logger.warn('Audit log forwarding failed', {
      requestId: entry.requestId,
      action: entry.action,
      resourceType: entry.resourceType,
      reason: error instanceof Error ? error.message : 'unknown_error',
    })
    return { ok: false, reason: 'audit_forward_failed' }
  }
}
