import { z } from 'zod'
import { parseBody } from '@vesta/shared/server/validation'
import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { checkRateLimit } from '@vesta/shared/server/adapters/redis'
import { sendMagicLinkEmail } from '@vesta/shared/server/adapters/mail'
import { createMagicLink } from '@vesta/shared/server/services'
import { env } from '@vesta/shared/utils/env'
import { MAGIC_LINK_TTL_MS } from '@vesta/shared/utils/auth-ttl'
import { withRequestContext, logger } from '@vesta/shared/server/log'
import { logCustomerRefusal } from '@/app/api/auth/log-failure'
import { cookies } from 'next/headers'
import { LANG_COOKIE, parseLang } from '@/lib/language'

const bodySchema = z.object({
  email: z.string().email('Invalid email address'),
  /** The page's language; older clients send none, so the vesta_lang cookie decides. */
  language: z.enum(['en', 'bn']).optional(),
})

export async function POST(request: Request): Promise<Response> {
  return withRequestContext(async () => {
  let email: string | undefined
  try {
    const body = await parseBody(request, bodySchema)
    email = body.email.toLowerCase().trim()

    const rl = await checkRateLimit(`magic-link:${email}`, 3, 3600)
    if (!rl.allowed) {
      throw new ApiError(429, 'Too many magic link requests. Try again later.', 'RATE_LIMITED')
    }

    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS)

    await createMagicLink(email, token, expiresAt)

    const magicLinkUrl = `${env.APP_URL}/api/auth/magic-link/callback?token=${token}`

    const language = body.language ?? parseLang((await cookies()).get(LANG_COOKIE)?.value)
    await sendMagicLinkEmail(email, magicLinkUrl, language)

    logger.customer('auth.magic-link.request', { email, ok: true })
    return Response.json({ message: 'Magic link sent' })
  } catch (error) {
    logCustomerRefusal('auth.magic-link.request', error, { email })
    return handleApiError(error)
  }
  }, { requestId: request.headers.get('x-request-id') ?? undefined })
}
