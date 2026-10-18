import { z } from 'zod'
import { parseBody } from '@vesta/shared/server/validation'
import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { issueJwt, setAuthCookie } from '@vesta/shared/server/auth'
import { verifyOtp, isSubscribed, storedSubscriberId } from '@vesta/shared/server/adapters/bdapps'
import { checkRateLimit } from '@vesta/shared/server/adapters/redis'
import { findOtpChallenge, completeOtpAuth, verifyAppOtp } from '@vesta/shared/server/services'
import { isDevModeEnabled } from '@vesta/shared/server/dev'
import { DEV_OTP_CODES } from '@vesta/shared/utils/config'
import { revalidateTag } from 'next/cache'
import { cacheTags } from '@/lib/cache-tags'
import { withRequestContext, setRequestUser, logger } from '@vesta/shared/server/log'
import { logCustomerRefusal } from '@/app/api/auth/log-failure'

const bodySchema = z.object({
  referenceNo: z.string().min(1, 'referenceNo is required'),
  otp: z.string().min(1, 'otp is required'),
})

export async function POST(request: Request): Promise<Response> {
  return withRequestContext(async () => {
  let referenceNo: string | undefined
  let phone: string | undefined
  try {
    const body = await parseBody(request, bodySchema)

    referenceNo = body.referenceNo
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

    phone = challenge.phone

    // DEV_MODE fake codes behave like a successful BDApps registration.
    let registered = true
    let subscriberId = challenge.phone
    let user
    if (challenge.codeHash) {
      // App OTP for an existing subscriber: we check the code, and the plan stays as it is.
      user = await verifyAppOtp(body.referenceNo, body.otp)
    } else {
      if (isDevModeEnabled()) {
        if (!DEV_OTP_CODES.includes(body.otp)) {
          throw new ApiError(400, 'Invalid OTP code', 'INVALID_OTP')
        }
      } else {
        const result = await verifyOtp(body.referenceNo, body.otp)
        // A charging-pending status still counts as Pro (ADR 0002); BDApps addresses
        // the number by a masked id from now on, so keep it for getStatus / unsubscribe.
        registered = isSubscribed(result.subscriptionStatus)
        subscriberId = storedSubscriberId(result, challenge.phone)
      }
      user = await completeOtpAuth(challenge.id, challenge.phone, registered, subscriberId)
    }
    setRequestUser(user.id)
    revalidateTag(cacheTags.user(user.id), { expire: 0 })

    const token = await issueJwt({
      sub: user.id,
      phone: user.phone ?? undefined,
      role: user.role,
    })
    await setAuthCookie(token)

    logger.customer('auth.otp.verify', {
      phone: challenge.phone,
      referenceNo: body.referenceNo,
      ok: true,
      ...(challenge.codeHash ? { appOtp: true } : { registered, subscriberId }),
      subscriptionStatus: user.subscriptionStatus,
    })
    return Response.json({
      user: {
        id: user.id,
        phone: user.phone,
        profileCompleted: user.profileCompleted,
      },
      token,
    })
  } catch (error) {
    logCustomerRefusal('auth.otp.verify', error, { phone, referenceNo })
    return handleApiError(error)
  }
  }, { requestId: request.headers.get('x-request-id') ?? undefined })
}
