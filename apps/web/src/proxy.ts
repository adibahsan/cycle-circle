import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { env } from '@vesta/shared/utils/env'
import { WEB_AUDIENCE, verifyAuthToken } from '@vesta/shared/utils/auth-token'

const PUBLIC_PATHS = ['/login', '/verify-otp', '/email-login', '/welcome', '/get-started', '/terms', '/privacy', '/api/', '/internal/']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p)) || pathname === '/') {
    return NextResponse.next()
  }

  const cookieName = env.AUTH_COOKIE_NAME
  const token = request.cookies.get(cookieName)?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const payload = await verifyAuthToken(token, WEB_AUDIENCE)
    // A foreign/admin token (e.g. leaked via a shared cookie) is not a valid web session
    if (payload.role === 'ADMIN') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return NextResponse.next()
  } catch {
    // expired or invalid token → back to login (never fall through to onboarding)
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
