import { z } from 'zod'
import { parseBody } from '@vesta/shared/server/validation'
import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { verifyOtp } from '@vesta/shared/server/adapters/bdapps'
import { checkRateLimit } from '@vesta/shared/server/adapters/redis'
import { findOtpChallenge, keepAccountWithVerifiedPhone } from '@vesta/shared/server/services'
import { isDevModeEnabled } from '@vesta/shared/server/dev'
import { DEV_OTP_CODES } from '@vesta/shared/utils/config'
import { withAuth } from '@vesta/shared/server/middleware'
import { prisma } from '@vesta/shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  referenceNo: z.string().min(1, 'referenceNo is required'),
  otp: z.string().min(1, 'otp is required'),
})

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await parseBody(request, bodySchema)

    const rl = await checkRateLimit(`otp:verify:${body.referenceNo}`, 5, 300)
    if (!rl.allowed) {
      throw new ApiError(429, 'Too many verification attempts. Try again later.', 'RATE_LIMITED')
    }

    const challenge = await findOtpChallenge(body.referenceNo)

    if (!challenge) {
      throw new ApiError(404, 'OTP challenge not found', 'CHALLENGE_NOT_FOUND')
    }
    if (challenge.verified) {
      throw new ApiError(400, 'OTP challenge already verified', 'ALREADY_VERIFIED')
    }
    if (new Date() > challenge.expiresAt) {
      throw new ApiError(400, 'OTP challenge has expired', 'CHALLENGE_EXPIRED')
    }

    if (isDevModeEnabled()) {
      if (!DEV_OTP_CODES.includes(body.otp)) {
        throw new ApiError(400, 'Invalid or expired code', 'INVALID_OTP')
      }
    } else {
      await verifyOtp(body.referenceNo, body.otp)
    }

    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { verified: true, userId: user.id },
    })

    try {
      await keepAccountWithVerifiedPhone(user.id, challenge.phone)
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') {
        throw new ApiError(409, 'Phone already registered to another account', 'PHONE_TAKEN')
      }
      throw e
    }

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}, { allowExpiredTrial: true })
