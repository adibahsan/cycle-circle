import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import { parseBody } from '@vesta/shared/server/validation'
import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { checkRateLimit } from '@vesta/shared/server/adapters/redis'
import { verifyEmailCode } from '@vesta/shared/server/services'
import { withAuth } from '@vesta/shared/server/middleware'
import { logger } from '@vesta/shared/server/log'
import { logCustomerRefusal } from '@/app/api/auth/log-failure'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  code: z.string().trim().min(1, 'code is required'),
})

/** Check the emailed code and, if right, save the address on the signed-in user. */
export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await parseBody(request, bodySchema)

    const rl = await checkRateLimit(`email-code:verify:${user.id}`, 10, 300)
    if (!rl.allowed) {
      throw new ApiError(429, 'Too many verification attempts. Try again later.', 'RATE_LIMITED')
    }

    const { email } = await verifyEmailCode(user.id, body.code)

    // Bust the cached user so settings and RSC show the new email at once.
    revalidateTag(`user:${user.id}`, { expire: 0 })
    revalidateTag(`profiles:${user.id}`, { expire: 0 })

    logger.customer('user.email.verify', { email, ok: true })
    return Response.json({ email })
  } catch (error) {
    logCustomerRefusal('user.email.verify', error, {})
    return handleApiError(error)
  }
}, { allowExpiredTrial: true })
