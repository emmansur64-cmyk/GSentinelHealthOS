import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/auth'
import { canAccess, AdminRole } from '@/modules/rbac/roles'
import { createRequestId } from '@/lib/request-id'
import { logger } from '@/lib/logger'
import { listTenants } from '@/services/admin-api/admin-api.client'
import { ApiError } from '@/lib/api-client'

export async function GET(): Promise<NextResponse> {
  const requestId = createRequestId()

  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!canAccess(admin.role, [AdminRole.SUPER_ADMIN, AdminRole.SYSTEM_ADMIN])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const tenants = await listTenants()
    logger.info('Tenant list fetched', { requestId, adminId: admin.sub, count: tenants.length })
    return NextResponse.json({ tenants })
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 503
    logger.error('Tenant list fetch failed', { requestId, error: String(error) })
    return NextResponse.json(
      { error: 'Backend unavailable — cannot load tenants', tenants: [] },
      { status },
    )
  }
}
