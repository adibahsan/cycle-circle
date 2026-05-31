import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { issueJwt, setAuthCookie } from '@vesta/shared/server/auth'
import { findMagicLink, completeMagicLinkAuth } from '@vesta/shared/server/services'

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url)
    const token = url.searchParams.get('token')

    if (!token) {
      throw new ApiError(400, 'Missing token parameter', 'MISSING_TOKEN')
    }

    const magicLink = await findMagicLink(token)

    if (!magicLink) {
      throw new ApiError(400, 'Invalid or expired magic link', 'INVALID_TOKEN')
    }
    if (magicLink.used) {
      throw new ApiError(400, 'Magic link has already been used', 'TOKEN_USED')
    }
    if (new Date() > magicLink.expiresAt) {
      throw new ApiError(400, 'Magic link has expired', 'TOKEN_EXPIRED')
    }

    const user = await completeMagicLinkAuth(magicLink.id, magicLink.email)

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
