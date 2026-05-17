import { NextRequest, NextResponse } from 'next/server'

import { getCurrentAdmin } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { createRequestId } from '@/lib/request-id'
import { AdminRole, canAccess } from '@/modules/rbac/roles'

const DEFAULT_CREATE_URL = 'http://frontend:3000/api/internal/client-onboarding'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = createRequestId()
  const admin = await getCurrentAdmin()

  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(admin.role, [AdminRole.SUPER_ADMIN, AdminRole.SYSTEM_ADMIN])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const createUrl = process.env.MEDICAL_AGENDA_CREATE_CLINIC_URL?.trim() || DEFAULT_CREATE_URL
  const internalKey =
    process.env.ADMIN_API_INTERNAL_KEY?.trim() ||
    process.env.PANEL_ADMIN_API_KEY?.trim() ||
    ''

  try {
    const payload = await request.json()
    const upstream = await fetch(createUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-key': internalKey },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })

    const body = await upstream.json().catch(() => null)
    if (!upstream.ok) {
      logger.warn('Client onboarding upstream failed', { requestId, status: upstream.status, createUrl })
      return NextResponse.json(
        { error: body?.error?.message ?? 'No se pudo crear el cliente en medical-agenda-saas' },
        { status: upstream.status || 502 },
      )
    }

    logger.info('Client onboarding created', { requestId, createUrl })
    return NextResponse.json({ ok: true, data: body?.data ?? body }, { status: 201 })
  } catch (error) {
    logger.error('Client onboarding route error', { requestId, error: String(error), createUrl })
    return NextResponse.json({ error: 'Error interno en alta de cliente' }, { status: 500 })
  }
}
