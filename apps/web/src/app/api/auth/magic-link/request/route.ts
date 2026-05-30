import { z } from 'zod'
import { parseBody } from '@vesta/shared/server/validation'
import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { checkRateLimit } from '@vesta/shared/server/adapters/redis'
import { sendMagicLinkEmail } from '@vesta/shared/server/adapters/mail'
import { createMagicLink } from '@vesta/shared/server/services'
import { env } from '@vesta/shared/utils/env'

const bodySchema = z.object({
  email: z.string().email('Invalid email address'),
  language: z.enum(['en', 'bn']).default('en'),
})

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await parseBody(request, bodySchema)
    const email = body.email.toLowerCase().trim()

    const rl = await checkRateLimit(`magic-link:${email}`, 3, 3600)
    if (!rl.allowed) {
      throw new ApiError(429, 'Too many magic link requests. Try again later.', 'RATE_LIMITED')
    }

    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await createMagicLink(email, token, expiresAt)

    const magicLinkUrl = `${env.APP_URL}/api/auth/magic-link/callback?token=${token}`

    await sendMagicLinkEmail(email, magicLinkUrl, body.language)

    return Response.json({ message: 'Magic link sent' })
  } catch (error) {
    return handleApiError(error)
  }
}
