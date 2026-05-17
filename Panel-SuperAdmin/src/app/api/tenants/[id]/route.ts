import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/auth'
import { canAccess, AdminRole } from '@/modules/rbac/roles'
import { createAuditLog, updateTenant } from '@/services/admin-api/admin-api.client'
import { createRequestId } from '@/lib/request-id'
import { logger } from '@/lib/logger'
import { ApiError } from '@/lib/api-client'
import type { TenantUpdatePayload } from '@/modules/tenants/tenant.types'
import { sanitizeTenantUpdatePayloadForLog } from '@/lib/security-sanitizer'

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
    if (!body.status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 422 })
    }

    const updated = await updateTenant(id, body)
    const sanitizedChanges = sanitizeTenantUpdatePayloadForLog(body)

    await createAuditLog({
      actorId: admin.sub,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: 'TENANT_UPDATE',
      resourceType: 'tenant',
      resourceId: id,
      metadata: { changes: sanitizedChanges },
      requestId,
    })

    logger.info('Tenant updated', { requestId, adminId: admin.sub, tenantId: id, changes: sanitizedChanges })
    return NextResponse.json({ tenant: updated, ok: true })
  } catch (error) {
    const httpStatus = error instanceof ApiError ? error.status : 503
    logger.error('Tenant update failed', { requestId, tenantId: id, error: String(error) })
    return NextResponse.json({ error: 'Backend unavailable — update failed' }, { status: httpStatus })
  }
}
