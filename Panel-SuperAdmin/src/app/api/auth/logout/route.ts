import { NextResponse } from 'next/server'
import { SA_TOKEN_COOKIE } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { createRequestId } from '@/lib/request-id'

export async function POST(): Promise<NextResponse> {
  const requestId = createRequestId()
  logger.info('Admin logout', { requestId })

  const response = NextResponse.json({ success: true })
  response.cookies.delete(SA_TOKEN_COOKIE)
  return response
}
