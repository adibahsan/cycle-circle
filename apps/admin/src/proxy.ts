import { jwtVerify } from 'jose'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { env } from '@vesta/shared/utils/env'
import { decideAdminAccess } from '@vesta/shared/utils/admin-access'

const PUBLIC_PATHS = ['/login', '/api/']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()

  const token = request.cookies.get(env.AUTH_COOKIE_NAME)?.value
  let payload: Record<string, unknown> | null = null
  if (token) {
    try {
      const secret = new TextEncoder().encode(env.JWT_SECRET)
      payload = (await jwtVerify(token, secret)).payload
    } catch {
      payload = null
    }
  }

  switch (decideAdminAccess({ hasToken: !!token, payload })) {
    case 'allow':
      return NextResponse.next()
    case 'forbidden':
      return NextResponse.rewrite(new URL('/forbidden', request.url), { status: 403 })
    default:
      return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
