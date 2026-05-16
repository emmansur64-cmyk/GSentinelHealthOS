import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/auth'
import { canAccess, AdminRole } from '@/modules/rbac/roles'
import { getProviderStatus } from '@/services/provider-config/provider-config.client'
import { createRequestId } from '@/lib/request-id'
import { logger } from '@/lib/logger'

export async function GET(): Promise<NextResponse> {
  const requestId = createRequestId()

  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!canAccess(admin.role, [AdminRole.SUPER_ADMIN, AdminRole.SYSTEM_ADMIN])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const providers = await getProviderStatus()
    logger.info('Provider status fetched', { requestId, adminId: admin.sub })
    return NextResponse.json({ providers })
  } catch (error) {
    logger.error('Provider status fetch failed', { requestId, error: String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
