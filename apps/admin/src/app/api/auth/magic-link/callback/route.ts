import { NextResponse } from 'next/server'
import { prisma } from '@vesta/shared'
import { issueJwt, setAuthCookie } from '@vesta/shared/server/auth'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) return NextResponse.redirect(new URL('/login', request.url))

  const link = await prisma.magicLink.findUnique({ where: { token } })
  if (!link || link.used || new Date() > link.expiresAt) {
    return NextResponse.redirect(new URL('/login?error=expired', request.url))
  }

  const user = link.userId
    ? await prisma.user.findUnique({ where: { id: link.userId } })
    : null

  if (!user || user.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/login?error=unauthorized', request.url))
  }

  await prisma.magicLink.update({ where: { id: link.id }, data: { used: true } })
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

  const jwt = await issueJwt({ sub: user.id, email: user.email ?? undefined, role: 'ADMIN' })
  await setAuthCookie(jwt)

  return NextResponse.redirect(new URL('/', request.url))
}
