import { z } from 'zod'
import { parseBody } from '@vesta/shared/server/validation'
import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { checkRateLimit } from '@vesta/shared/server/adapters/redis'
import { requestEmailVerification, getEmailCodeCooldownRemaining } from '@vesta/shared/server/services'
import { isDevModeEnabled } from '@vesta/shared/server/dev'
import { withAuth } from '@vesta/shared/server/middleware'
import { logger } from '@vesta/shared/server/log'
import { logCustomerRefusal } from '@/app/api/auth/log-failure'
import { assertOtpIpLimit } from '@/app/api/auth/client-ip'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  email: z.string().min(1, 'Email is required'),
})

/** Mail a 6-digit code to the address the signed-in user wants to add or change. */
export const POST = withAuth(async (request, { user }) => {
  let email: string | undefined
  try {
    const body = await parseBody(request, bodySchema)

    // Cooldown first so a blocked resend doesn't use up the per-minute budget.
    const cooldown = await getEmailCodeCooldownRemaining(user.id, new Date())
    if (cooldown > 0) {
      throw new ApiError(429, `Please wait ${cooldown}s before requesting a new code.`, 'OTP_COOLDOWN')
    }
    const rl = await checkRateLimit(`email-code:${user.id}`, 3, 60)
    if (!rl.allowed) {
      throw new ApiError(429, 'Too many code requests. Try again in a minute.', 'RATE_LIMITED')
    }
    await assertOtpIpLimit(request)

    const sent = await requestEmailVerification(user.id, body.email, new Date())
    email = sent.email

    logger.customer('user.email.request', {
      email,
      ok: true,
      dev: isDevModeEnabled(),
      // Dev only: support/devs read the code from the log (never in production).
      ...(isDevModeEnabled() ? { code: sent.code } : {}),
    })
    return Response.json({ ok: true })
  } catch (error) {
    logCustomerRefusal('user.email.request', error, { email })
    return handleApiError(error)
  }
}, { allowExpiredTrial: true })
