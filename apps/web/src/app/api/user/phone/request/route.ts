import { z } from 'zod'
import { parseBody } from '@vesta/shared/server/validation'
import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { validateMsisdn } from '@vesta/shared/server/auth'
import { checkRateLimit } from '@vesta/shared/server/adapters/redis'
import { requestOtp } from '@vesta/shared/server/adapters/bdapps'
import { createOtpChallenge, getOtpResendCooldownRemaining } from '@vesta/shared/server/services'
import { isDevModeEnabled } from '@vesta/shared/server/dev'
import { withAuth } from '@vesta/shared/server/middleware'
import { prisma } from '@vesta/shared'
import { logger } from '@vesta/shared/server/log'
import { logCustomerRefusal } from '@/app/api/auth/log-failure'
import { assertOtpIpLimit } from '@/app/api/auth/client-ip'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  phone: z.string().min(1, 'Phone is required'),
})

export const POST = withAuth(async (request, { user }) => {
  let phone: string | undefined
  try {
    const body = await parseBody(request, bodySchema)

    const normalized = validateMsisdn(body.phone)
    phone = normalized

    // Uniqueness pre-check: phone must not belong to a different account
    const existing = await prisma.user.findUnique({
      where: { phone: normalized },
      select: { id: true },
    })
    if (existing && existing.id !== user.id) {
      throw new ApiError(409, 'Phone already registered to another account', 'PHONE_TAKEN')
    }

    // SRS FR-AUTH: OTP resend only after a 60s cooldown. Checked before the
    // abuse limiter so a blocked resend doesn't consume the per-minute budget.
    const cooldown = await getOtpResendCooldownRemaining(normalized)
    if (cooldown > 0) {
      throw new ApiError(
        429,
        `Please wait ${cooldown}s before requesting a new code.`,
        'OTP_COOLDOWN',
      )
    }

    const rl = await checkRateLimit(`otp:${normalized}`, 3, 60)
    if (!rl.allowed) {
      throw new ApiError(429, 'Too many OTP requests. Try again in a minute.', 'RATE_LIMITED')
    }
    await assertOtpIpLimit(request)

    let referenceNo: string

    if (isDevModeEnabled()) {
      referenceNo = `dev-${crypto.randomUUID()}`
    } else {
      const result = await requestOtp(normalized)
      referenceNo = result.referenceNo
    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
    await createOtpChallenge(normalized, referenceNo, expiresAt)

    logger.customer('user.phone.request', { phone: normalized, referenceNo, ok: true, dev: isDevModeEnabled() })
    return Response.json({ referenceNo, message: 'OTP sent' })
  } catch (error) {
    logCustomerRefusal('user.phone.request', error, { phone })
    return handleApiError(error)
  }
}, { allowExpiredTrial: true })
