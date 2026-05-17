import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import type { AdminRole } from '@/modules/rbac/roles'

export const SA_TOKEN_COOKIE = 'super_admin_session'
export const SA_TOKEN_TTL_SECONDS = 60 * 60 * 8 // 8 hours

export interface AdminTokenPayload {
  sub: string
  email: string
  role: AdminRole
  sessionId: string
  passwordChangeRequired?: boolean
  iat?: number
  exp?: number
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.SUPER_ADMIN_JWT_SECRET
  if (!secret) throw new Error('SUPER_ADMIN_JWT_SECRET is not set')
  return new TextEncoder().encode(secret)
}

export async function signAdminToken(
  payload: Omit<AdminTokenPayload, 'iat' | 'exp'>,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SA_TOKEN_TTL_SECONDS}s`)
    .sign(getJwtSecret())
}

export async function verifyAdminToken(token: string): Promise<AdminTokenPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret())
  return payload as unknown as AdminTokenPayload
}

// Server component helper — reads from the request cookie store
export async function getCurrentAdmin(): Promise<AdminTokenPayload | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SA_TOKEN_COOKIE)?.value
    if (!token) return null
    return await verifyAdminToken(token)
  } catch {
    return null
  }
}
