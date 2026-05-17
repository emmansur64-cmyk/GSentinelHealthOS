import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const SA_TOKEN_COOKIE = 'super_admin_session'

// Routes that bypass auth
const PUBLIC_PATHS = ['/login', '/api/auth/login']

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // Static assets bypass
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  if (isPublic(pathname)) {
    return NextResponse.next()
  }

  const token = request.cookies.get(SA_TOKEN_COOKIE)?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const configuredSecret = (process.env.SUPER_ADMIN_JWT_SECRET ?? '').trim()
    if (!configuredSecret) {
      // Fail-closed: without a configured signing secret, auth is invalid by definition.
      const response = NextResponse.redirect(new URL('/login', request.url))
      response.cookies.delete(SA_TOKEN_COOKIE)
      return response
    }
    const secret = new TextEncoder().encode(configuredSecret)
    const { payload } = await jwtVerify(token, secret)

    const response = NextResponse.next()
    // Propagate identity headers to API routes and server components
    response.headers.set('x-admin-id', (payload.sub as string) ?? '')
    response.headers.set('x-admin-role', (payload.role as string) ?? '')
    response.headers.set('x-admin-email', (payload.email as string) ?? '')
    return response
  } catch {
    // Token invalid or expired — clear cookie and redirect
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete(SA_TOKEN_COOKIE)
    return response
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
