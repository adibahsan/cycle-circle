import { z } from 'zod'
import { parseBody } from '@vesta/shared/server/validation'
import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { validateMsisdn } from '@vesta/shared/server/auth'
import { checkRateLimit } from '@vesta/shared/server/adapters/redis'
import { requestOtp } from '@vesta/shared/server/adapters/bdapps'
import { createOtpChallenge, getOtpResendCooldownRemaining } from '@vesta/shared/server/services'
import { isDevModeEnabled } from '@vesta/shared/server/dev'
import { withRequestContext, logger } from '@vesta/shared/server/log'
import { logCustomerRefusal } from '@/app/api/auth/log-failure'

const bodySchema = z.object({
  phone: z.string().min(1, 'Phone is required'),
})

export async function POST(request: Request): Promise<Response> {
  return withRequestContext(async () => {
  let phone: string | undefined
  try {
    const body = await parseBody(request, bodySchema)

    const normalizedPhone = validateMsisdn(body.phone)
    phone = normalizedPhone

    // SRS FR-AUTH: OTP resend only after a 60s cooldown. Checked before the
    // abuse limiter so a blocked resend doesn't consume the per-minute budget.
    const cooldown = await getOtpResendCooldownRemaining(normalizedPhone)
    if (cooldown > 0) {
      throw new ApiError(
        429,
        `Please wait ${cooldown}s before requesting a new code.`,
        'OTP_COOLDOWN',
      )
    }

    const rl = await checkRateLimit(`otp:${normalizedPhone}`, 3, 60)
    if (!rl.allowed) {
      throw new ApiError(429, 'Too many OTP requests. Try again in a minute.', 'RATE_LIMITED')
    }

    let referenceNo: string

    if (isDevModeEnabled()) {
      referenceNo = `dev-${crypto.randomUUID()}`
    } else {
      const result = await requestOtp(normalizedPhone)
      referenceNo = result.referenceNo
    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
    await createOtpChallenge(normalizedPhone, referenceNo, expiresAt)

    logger.customer('auth.otp.request', { phone: normalizedPhone, referenceNo, ok: true, dev: isDevModeEnabled() })
    return Response.json({ referenceNo, message: 'OTP sent' })
  } catch (error) {
    logCustomerRefusal('auth.otp.request', error, { phone })
    return handleApiError(error)
  }
  }, { requestId: request.headers.get('x-request-id') ?? undefined })
}
