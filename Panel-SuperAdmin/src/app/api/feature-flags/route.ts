import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/auth'
import { canAccess, AdminRole } from '@/modules/rbac/roles'
import { getFeatureFlags, toggleFeatureFlag } from '@/services/admin-api/admin-api.client'
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
    const flags = await getFeatureFlags()
    logger.info('Feature flags fetched', { requestId, adminId: admin.sub })
    return NextResponse.json({ flags })
  } catch (error) {
    logger.error('Feature flags fetch failed', { requestId, error: String(error) })
    return NextResponse.json(
      { error: 'Backend unavailable — cannot load feature flags', flags: [] },
      { status: 503 },
    )
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const requestId = createRequestId()

  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!canAccess(admin.role, [AdminRole.SUPER_ADMIN, AdminRole.SYSTEM_ADMIN])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { key, enabled } = body

    if (typeof key !== 'string' || typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'key (string) and enabled (boolean) are required' },
        { status: 400 },
      )
    }

    // Backend handles the flag update AND creates the audit log internally
    const flag = await toggleFeatureFlag(key, enabled, admin.email)

    logger.info('Feature flag toggled', { requestId, adminId: admin.sub, key, enabled })
    return NextResponse.json({ flag })
  } catch (error) {
    logger.error('Feature flag toggle failed', { requestId, error: String(error) })
    return NextResponse.json(
      { error: 'Backend unavailable — flag toggle failed' },
      { status: 503 },
    )
  }
}
