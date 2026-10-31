import { z } from 'zod'
import { parseBody } from '@vesta/shared/server/validation'
import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { validateMsisdn } from '@vesta/shared/server/auth'
import { checkRateLimit } from '@vesta/shared/server/adapters/redis'
import { getOtpResendCooldownRemaining, requestLoginOtp } from '@vesta/shared/server/services'
import { isDevModeEnabled } from '@vesta/shared/server/dev'
import { withRequestContext, logger } from '@vesta/shared/server/log'
import { logCustomerRefusal } from '@/app/api/auth/log-failure'
import { assertOtpIpLimit } from '@/app/api/auth/client-ip'
import { cookies } from 'next/headers'
import { LANG_COOKIE, parseLang } from '@/lib/language'

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
    const cooldown = await getOtpResendCooldownRemaining(normalizedPhone, new Date())
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
    await assertOtpIpLimit(request)

    const lang = parseLang((await cookies()).get(LANG_COOKIE)?.value)
    const otp = await requestLoginOtp(normalizedPhone, lang, new Date())

    if (otp.kind === 'fallback') {
      // Existing subscriber we can't SMS (ADR 0002): the client offers email login or unsubscribe-and-retry.
      logger.customer(
        'auth.otp.request',
        { phone: normalizedPhone, ok: false, status: 409, code: 'ALREADY_SUBSCRIBED', reason: otp.reason, hasEmail: otp.hasEmail },
        { level: 'warn' },
      )
      return Response.json(
        { error: { message: 'This number is already subscribed', code: 'ALREADY_SUBSCRIBED', hasEmail: otp.hasEmail } },
        { status: 409 },
      )
    }

    logger.customer('auth.otp.request', {
      phone: normalizedPhone,
      referenceNo: otp.referenceNo,
      ok: true,
      dev: isDevModeEnabled(),
      ...(otp.kind === 'sent' ? { appOtp: true, code: otp.code } : {}),
    })
    return Response.json({ referenceNo: otp.referenceNo, message: 'OTP sent' })
  } catch (error) {
    logCustomerRefusal('auth.otp.request', error, { phone })
    return handleApiError(error)
  }
  }, { requestId: request.headers.get('x-request-id') ?? undefined })
}
