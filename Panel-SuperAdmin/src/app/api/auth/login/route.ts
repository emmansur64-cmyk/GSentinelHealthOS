import { NextRequest, NextResponse } from 'next/server'
import { signAdminToken, SA_TOKEN_COOKIE, SA_TOKEN_TTL_SECONDS } from '@/lib/auth'
import { AdminRole } from '@/modules/rbac/roles'
import { createRequestId } from '@/lib/request-id'
import { logger } from '@/lib/logger'
import { validateSuperAdminCredentials } from '@/lib/super-admin-credentials'
import { clearLoginAttempts, getLoginAttemptDecision, registerLoginFailure } from '@/lib/login-attempt-guard'

export const runtime = 'nodejs'

function shouldUseSecureCookie(): boolean {
  const override = (process.env.SUPER_ADMIN_COOKIE_SECURE ?? '').trim().toLowerCase()
  if (override === 'true') return true
  if (override === 'false') return false
  return process.env.NODE_ENV === 'production'
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = createRequestId()
  const xff = req.headers.get('x-forwarded-for') ?? ''
  const clientIp = xff.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
  const invalidCredentialsResponse = NextResponse.json(
    { error: 'Invalid credentials' },
    { status: 401 },
  )

  try {
    const body = await req.json().catch(() => null)

    if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') {
      return NextResponse.json({ error: 'email and password are required' }, { status: 400 })
    }

    const { email, password } = body

    if (!email.trim() || !password.trim()) {
      return NextResponse.json({ error: 'email and password cannot be empty' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const decision = getLoginAttemptDecision(clientIp, normalizedEmail)
    if (!decision.allowed) {
      logger.warn('Super admin login temporarily locked', {
        requestId,
        clientIp,
        retryAfterMs: decision.retryAfterMs,
      })
      return invalidCredentialsResponse
    }

    const user = await validateSuperAdminCredentials(normalizedEmail, password)

    if (!user) {
      const status = registerLoginFailure(clientIp, normalizedEmail)
      logger.warn('Failed admin login attempt', {
        requestId,
        clientIp,
        emailHash: Buffer.from(normalizedEmail).toString('base64').slice(0, 12),
        failures: status.failures,
        locked: status.lockedUntil > Date.now(),
      })
      return invalidCredentialsResponse
    }

    clearLoginAttempts(clientIp, normalizedEmail)

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
      secure: shouldUseSecureCookie(),
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
