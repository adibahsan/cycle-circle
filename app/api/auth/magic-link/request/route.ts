import { z } from 'zod'
import { parseBody } from '@/lib/server/validation'
import { handleApiError, ApiError } from '@/lib/server/api-error'
import { checkRateLimit } from '@/lib/server/adapters/redis'
import { sendMagicLinkEmail } from '@/lib/server/adapters/mail'
import { prisma } from '@/lib/server/db'

const bodySchema = z.object({
  email: z.string().email('Invalid email address'),
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

    await prisma.magicLink.create({
      data: {
        email,
        token,
        expiresAt,
      },
    })

    const appUrl = process.env.APP_URL ?? 'http://localhost:3000'
    const magicLinkUrl = `${appUrl}/api/auth/magic-link/callback?token=${token}`

    await sendMagicLinkEmail(email, magicLinkUrl, 'en')

    return Response.json({ message: 'Magic link sent' })
  } catch (error) {
    return handleApiError(error)
  }
}
