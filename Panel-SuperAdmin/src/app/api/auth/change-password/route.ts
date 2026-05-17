import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdmin, SA_TOKEN_COOKIE, SA_TOKEN_TTL_SECONDS, signAdminToken } from '@/lib/auth'
import { changeSuperAdminPassword } from '@/lib/super-admin-credentials'

export const runtime = 'nodejs'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword.trim() : ''
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword.trim() : ''

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'currentPassword and newPassword are required' }, { status: 400 })
  }

  if (newPassword.length < 12) {
    return NextResponse.json({ error: 'New password must be at least 12 characters' }, { status: 400 })
  }

  const changed = await changeSuperAdminPassword(currentPassword, newPassword)
  if (!changed.ok) {
    return NextResponse.json({ error: changed.error }, { status: 400 })
  }

  const token = await signAdminToken({
    sub: admin.sub,
    email: admin.email,
    role: admin.role,
    sessionId: crypto.randomUUID(),
    passwordChangeRequired: false,
  })

  const response = NextResponse.json({ success: true })
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
}
