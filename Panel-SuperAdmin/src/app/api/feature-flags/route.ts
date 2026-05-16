import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/auth'
import { canAccess, AdminRole } from '@/modules/rbac/roles'
import { createRequestId } from '@/lib/request-id'
import { logger } from '@/lib/logger'
import type { FeatureFlag } from '@/modules/feature-flags/flags.types'

// In-memory store for bootstrap phase.
// TODO: persist to PostgreSQL via api service when admin DB schema is ready.
const FLAGS: FeatureFlag[] = [
  {
    key: 'mb_chat_enabled',
    label: 'MB-Chat',
    description: 'Enable AI chat module for all tenants',
    enabled: true,
    scope: 'global',
    module: 'MB-Chat',
    updatedAt: new Date().toISOString(),
  },
  {
    key: 'mb_secretaria_enabled',
    label: 'MB-Secretaria',
    description: 'Enable secretarial scheduling module',
    enabled: true,
    scope: 'global',
    module: 'MB-Secretaria',
    updatedAt: new Date().toISOString(),
  },
  {
    key: 'mb_whatsapp_enabled',
    label: 'MB-Whatsapp',
    description: 'Enable WhatsApp integration module',
    enabled: true,
    scope: 'global',
    module: 'MB-Whatsapp',
    updatedAt: new Date().toISOString(),
  },
  {
    key: 'brain_core_enabled',
    label: 'Brain Core',
    description: 'Enable AI decision engine',
    enabled: true,
    scope: 'global',
    module: 'Brain Core',
    updatedAt: new Date().toISOString(),
  },
  {
    key: 'doctor_triage_gate',
    label: 'Triage Gate',
    description: 'Require triage contract before doctor chat escalation',
    enabled: true,
    scope: 'per-tenant',
    module: 'MB-Chat',
    updatedAt: new Date().toISOString(),
  },
]

export async function GET(): Promise<NextResponse> {
  const requestId = createRequestId()

  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!canAccess(admin.role, [AdminRole.SUPER_ADMIN, AdminRole.SYSTEM_ADMIN])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  logger.info('Feature flags fetched', { requestId, adminId: admin.sub })
  return NextResponse.json({ flags: FLAGS })
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
      return NextResponse.json({ error: 'key (string) and enabled (boolean) required' }, { status: 400 })
    }

    const flag = FLAGS.find((f) => f.key === key)
    if (!flag) {
      return NextResponse.json({ error: `Flag '${key}' not found` }, { status: 404 })
    }

    flag.enabled = enabled
    flag.updatedAt = new Date().toISOString()
    flag.updatedBy = admin.email

    logger.info('Feature flag toggled', { requestId, adminId: admin.sub, key, enabled })
    return NextResponse.json({ flag })
  } catch (error) {
    logger.error('Feature flag toggle failed', { requestId, error: String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
