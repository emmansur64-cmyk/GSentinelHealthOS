import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/auth'
import { getSystemHealth } from '@/services/system-health/health.client'
import { createRequestId } from '@/lib/request-id'
import { logger } from '@/lib/logger'

export async function GET(): Promise<NextResponse> {
  const requestId = createRequestId()

  const admin = await getCurrentAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const report = await getSystemHealth()
    logger.info('System health check', { requestId, adminId: admin.sub, overallStatus: report.overallStatus })
    return NextResponse.json(report)
  } catch (error) {
    logger.error('System health check failed', { requestId, error: String(error) })
    return NextResponse.json({ error: 'Health check failed' }, { status: 500 })
  }
}
