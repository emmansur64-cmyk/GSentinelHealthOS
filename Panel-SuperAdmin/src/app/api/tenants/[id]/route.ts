import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/auth'
import { canAccess, AdminRole } from '@/modules/rbac/roles'
import { updateTenant } from '@/services/admin-api/admin-api.client'
import { createRequestId } from '@/lib/request-id'
import { logger } from '@/lib/logger'
import type { TenantUpdatePayload } from '@/modules/tenants/tenant.types'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const requestId = createRequestId()
  const { id } = await params

  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!canAccess(admin.role, [AdminRole.SUPER_ADMIN, AdminRole.SYSTEM_ADMIN])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body: TenantUpdatePayload = await req.json()
    const updated = await updateTenant(id, body)
    logger.info('Tenant updated', { requestId, adminId: admin.sub, tenantId: id, payload: body })
    return NextResponse.json({ tenant: updated })
  } catch (error) {
    logger.error('Tenant update failed', { requestId, tenantId: id, error: String(error) })
    return NextResponse.json({ error: 'Update failed — backend endpoint pending' }, { status: 503 })
  }
}
