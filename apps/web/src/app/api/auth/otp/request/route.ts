import { z } from 'zod'
import { parseBody } from '@vesta/shared/server/validation'
import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { validateMsisdn } from '@vesta/shared/server/auth'
import { checkRateLimit } from '@vesta/shared/server/adapters/redis'
import { requestOtp } from '@vesta/shared/server/adapters/bdapps'
import { createOtpChallenge, getOtpResendCooldownRemaining, startAppOtpLogin } from '@vesta/shared/server/services'
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
    await assertOtpIpLimit(request)

    let referenceNo: string

    if (isDevModeEnabled()) {
      referenceNo = `dev-${crypto.randomUUID()}`
    } else {
      try {
        const result = await requestOtp(normalizedPhone)
        referenceNo = result.referenceNo
      } catch (error) {
        if (!(error instanceof ApiError && error.code === 'ALREADY_SUBSCRIBED')) throw error
        // BDApps won't send its OTP to an existing subscriber (E1351): send an App OTP (ADR 0002).
        const lang = parseLang((await cookies()).get(LANG_COOKIE)?.value)
        const app = await startAppOtpLogin(normalizedPhone, lang)
        if (app.kind === 'fallback') {
          logger.customer(
            'auth.otp.app-fallback',
            { phone: normalizedPhone, hasEmail: app.hasEmail, ok: false },
            { level: 'warn' },
          )
          return Response.json(
            { error: { message: 'This number is already subscribed', code: 'ALREADY_SUBSCRIBED', hasEmail: app.hasEmail } },
            { status: 409 },
          )
        }
        logger.customer('auth.otp.request', { phone: normalizedPhone, referenceNo: app.referenceNo, ok: true, appOtp: true })
        return Response.json({ referenceNo: app.referenceNo, message: 'OTP sent' })
      }
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
