import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/auth'
import { canAccess, AdminRole } from '@/modules/rbac/roles'
import { createRequestId } from '@/lib/request-id'
import { logger } from '@/lib/logger'
import type { AuditLogEntry } from '@/modules/audit/audit.types'

// In-memory audit log for bootstrap phase.
// TODO: persist to PostgreSQL audit_log table when DB schema is ready.
const AUDIT_STORE: AuditLogEntry[] = []

export function appendAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
  AUDIT_STORE.unshift({
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  })
  // Keep last 500 entries in memory
  if (AUDIT_STORE.length > 500) AUDIT_STORE.splice(500)
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const requestId = createRequestId()

  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!canAccess(admin.role, [AdminRole.SUPER_ADMIN, AdminRole.SYSTEM_ADMIN, AdminRole.AUDITOR])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))
  const offset = (page - 1) * limit

  const slice = AUDIT_STORE.slice(offset, offset + limit)

  logger.info('Audit logs fetched', { requestId, adminId: admin.sub, page, limit })
  return NextResponse.json({
    logs: slice,
    total: AUDIT_STORE.length,
    page,
    limit,
  })
}
