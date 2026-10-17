import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import { parseBody } from '@vesta/shared/server/validation'
import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { verifyOtp, isSubscribed, storedSubscriberId } from '@vesta/shared/server/adapters/bdapps'
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

    // DEV_MODE fake codes behave like a successful BDApps registration.
    let registered = true
    let subscriberId = challenge.phone
    if (isDevModeEnabled()) {
      if (!DEV_OTP_CODES.includes(body.otp)) {
        throw new ApiError(400, 'Invalid or expired code', 'INVALID_OTP')
      }
    } else {
      const result = await verifyOtp(body.referenceNo, body.otp)
      // A charging-pending status still counts as Pro (ADR 0002); BDApps addresses
      // the number by a masked id from now on, so keep it for getStatus / unsubscribe.
      registered = isSubscribed(result.subscriptionStatus)
      subscriberId = storedSubscriberId(result, challenge.phone)
    }

    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { verified: true, userId: user.id },
    })

    let result: Awaited<ReturnType<typeof keepAccountWithVerifiedPhone>>
    try {
      result = await keepAccountWithVerifiedPhone(user.id, challenge.phone, registered, subscriberId)
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') {
        throw new ApiError(409, 'Phone already registered to another account', 'PHONE_TAKEN')
      }
      throw e
    }

    // Bust the cached user/profiles (getCurrentUser uses unstable_cache with these
    // tags) so the account page + RSC reflect the new phone / PRO status without
    // waiting for the 5-min TTL. Mirrors updateContactInfo in user-actions.ts.
    revalidateTag(`user:${user.id}`, { expire: 0 })
    revalidateTag(`profiles:${user.id}`, { expire: 0 })

    return Response.json({ ok: true, subscriptionStatus: result.subscriptionStatus })
  } catch (error) {
    return handleApiError(error)
  }
}, { allowExpiredTrial: true })
