import { handleApiError, ApiError } from '@/server/api-error'
import { issueJwt, setAuthCookie } from '@/server/auth'
import { prisma } from '@/server/db'

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url)
    const token = url.searchParams.get('token')

    if (!token) {
      throw new ApiError(400, 'Missing token parameter', 'MISSING_TOKEN')
    }

    const magicLink = await prisma.magicLink.findUnique({
      where: { token },
    })

    if (!magicLink) {
      throw new ApiError(400, 'Invalid or expired magic link', 'INVALID_TOKEN')
    }
    if (magicLink.used) {
      throw new ApiError(400, 'Magic link has already been used', 'TOKEN_USED')
    }
    if (new Date() > magicLink.expiresAt) {
      throw new ApiError(400, 'Magic link has expired', 'TOKEN_EXPIRED')
    }

    await prisma.magicLink.update({
      where: { id: magicLink.id },
      data: { used: true },
    })

    const emailTrialExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    const user = await prisma.user.upsert({
      where: { email: magicLink.email },
      create: {
        email: magicLink.email,
        authMethod: 'EMAIL',
        emailTrialExpiresAt,
      },
      update: {
        emailTrialExpiresAt,
      },
    })

    await prisma.magicLink.update({
      where: { id: magicLink.id },
      data: { userId: user.id },
    })

    const jwtToken = await issueJwt({
      sub: user.id,
      email: user.email ?? undefined,
      role: user.role,
    })
    await setAuthCookie(jwtToken)

    return Response.redirect(new URL('/?auth=success', request.url), 302)
  } catch (error) {
    return handleApiError(error)
  }
}
