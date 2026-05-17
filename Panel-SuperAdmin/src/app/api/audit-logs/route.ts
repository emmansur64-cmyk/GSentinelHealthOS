import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/auth'
import { canAccess, AdminRole } from '@/modules/rbac/roles'
import { getAuditLogs, createAuditLog } from '@/services/admin-api/admin-api.client'
import { createRequestId } from '@/lib/request-id'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const requestId = createRequestId()

  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!canAccess(admin.role, [AdminRole.SUPER_ADMIN, AdminRole.SYSTEM_ADMIN, AdminRole.AUDITOR])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))
    const action = searchParams.get('action') ?? undefined

    const result = await getAuditLogs({ page, limit, action })
    logger.info('Audit logs fetched', { requestId, adminId: admin.sub, page, limit })
    return NextResponse.json(result)
  } catch (error) {
    logger.error('Audit logs fetch failed', { requestId, error: String(error) })
    return NextResponse.json(
      { error: 'Backend unavailable — cannot load audit logs', logs: [], total: 0, page: 1, limit: 50 },
      { status: 503 },
    )
  }
}

// Internal: called server-side from other Panel API routes to record events
export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = createRequestId()

  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    await createAuditLog({
      actorId: admin.sub,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: body.action,
      resourceType: body.resourceType,
      resourceId: body.resourceId,
      metadata: body.metadata,
      requestId,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Audit log create failed', { requestId, error: String(error) })
    return NextResponse.json({ error: 'Failed to create audit log' }, { status: 500 })
  }
}
