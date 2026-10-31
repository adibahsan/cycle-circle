import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { WEB_AUDIENCE, issueJwt, setAuthCookie } from '@vesta/shared/server/auth'
import { findMagicLink, completeMagicLinkAuth } from '@vesta/shared/server/services'
import { revalidateTag } from 'next/cache'
import { cacheTags } from '@/lib/cache-tags'
import { withRequestContext, setRequestUser, logger } from '@vesta/shared/server/log'
import { logCustomerRefusal } from '@/app/api/auth/log-failure'
import { env } from '@vesta/shared/utils/env'

// Redirect to the public origin. Behind nginx, request.url is the internal
// upstream (http://localhost:3000), so it can't be the base.
const publicUrl = (path: string) => new URL(path, env.APP_URL)

const LINK_ERROR_CODES = new Set(['TOKEN_EXPIRED', 'TOKEN_USED', 'INVALID_TOKEN'])

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(async () => {
  try {
    const url = new URL(request.url)
    const token = url.searchParams.get('token')

    if (!token) {
      throw new ApiError(400, 'Missing token parameter', 'INVALID_TOKEN')
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

    const user = await completeMagicLinkAuth(magicLink.id, magicLink.email, new Date())
    setRequestUser(user.id)
    revalidateTag(cacheTags.user(user.id), { expire: 0 })

    const jwtToken = await issueJwt({
      sub: user.id,
      email: user.email ?? undefined,
      role: user.role,
    }, WEB_AUDIENCE)
    await setAuthCookie(jwtToken)

    logger.customer('auth.magic-link.verify', { email: magicLink.email, ok: true })
    return Response.redirect(publicUrl('/?auth=success'), 302)
  } catch (error) {
    logCustomerRefusal('auth.magic-link.verify', error)
    // A link opened from an email is a page navigation: send expected failures to the
    // login page with a user-facing message instead of raw JSON.
    if (error instanceof ApiError && error.code && LINK_ERROR_CODES.has(error.code)) {
      return Response.redirect(publicUrl(`/email-login?error=${error.code}`), 302)
    }
    return handleApiError(error)
  }
  }, { requestId: request.headers.get('x-request-id') ?? undefined })
}
