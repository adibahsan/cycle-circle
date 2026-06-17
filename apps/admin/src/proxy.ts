import { jwtVerify } from 'jose'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { env } from '@vesta/shared/utils/env'

const PUBLIC_PATHS = ['/login', '/api/']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()

  const cookieName = env.AUTH_COOKIE_NAME
  const token = request.cookies.get(cookieName)?.value
  if (!token) return NextResponse.redirect(new URL('/login', request.url))

  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    if (payload.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
