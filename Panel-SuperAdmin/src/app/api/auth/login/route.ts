import { NextRequest, NextResponse } from 'next/server'
import { signAdminToken, SA_TOKEN_COOKIE, SA_TOKEN_TTL_SECONDS } from '@/lib/auth'
import { AdminRole } from '@/modules/rbac/roles'
import { createRequestId } from '@/lib/request-id'
import { logger } from '@/lib/logger'
import { validateSuperAdminCredentials } from '@/lib/super-admin-credentials'

export const runtime = 'nodejs'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = createRequestId()

  try {
    const body = await req.json().catch(() => null)

    if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') {
      return NextResponse.json({ error: 'email and password are required' }, { status: 400 })
    }

    const { email, password } = body

    if (!email.trim() || !password.trim()) {
      return NextResponse.json({ error: 'email and password cannot be empty' }, { status: 400 })
    }

    const user = await validateSuperAdminCredentials(email.toLowerCase().trim(), password)

    if (!user) {
      logger.warn('Failed admin login attempt', { requestId, email })
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const sessionId = crypto.randomUUID()
    const token = await signAdminToken({
      sub: user.id,
      email: user.email,
      role: AdminRole.SUPER_ADMIN,
      sessionId,
      passwordChangeRequired: user.mustChangePassword,
    })

    logger.info('Admin login successful', { requestId, email: user.email, role: AdminRole.SUPER_ADMIN })

    const response = NextResponse.json({
      success: true,
      role: AdminRole.SUPER_ADMIN,
      mustChangePassword: user.mustChangePassword,
    })
    response.cookies.set({
      name: SA_TOKEN_COOKIE,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SA_TOKEN_TTL_SECONDS,
      path: '/',
    })

    return response
  } catch (error) {
    logger.error('Login handler error', { requestId, error: String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
