import { z } from 'zod'
import { parseBody } from '@vesta/shared/server/validation'
import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { issueJwt, setAuthCookie, validateMsisdn } from '@vesta/shared/server/auth'
import { subscriptionGetStatus } from '@vesta/shared/server/adapters/bdapps'
import { completeSubscriptionLogin } from '@vesta/shared/server/services'
import { checkSubscriptionRateLimit } from '../rate-limit'

const bodySchema = z.object({
  phone: z.string().min(1, 'Phone is required'),
})

const SUBSCRIPTION_AMOUNT_BDT = 5

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await parseBody(request, bodySchema)
    const normalizedPhone = validateMsisdn(body.phone)

    const rl = checkSubscriptionRateLimit(`subscription:status:${normalizedPhone}`, 3, 60)
    if (!rl.allowed) {
      throw new ApiError(429, 'Too many subscription status requests. Try again in a minute.', 'RATE_LIMITED')
    }

    const status = await subscriptionGetStatus(normalizedPhone)

    if (status.subscriptionStatus !== 'REGISTERED') {
      return Response.json({
        authenticated: false,
        subscriptionStatus: status.subscriptionStatus,
        message: 'Subscription not registered',
      })
    }

    const user = await completeSubscriptionLogin(
      normalizedPhone,
      status.subscriberId ?? normalizedPhone,
      SUBSCRIPTION_AMOUNT_BDT,
    )
    const token = await issueJwt({
      sub: user.id,
      phone: user.phone ?? undefined,
      role: user.role,
    })
    await setAuthCookie(token)

    return Response.json({
      authenticated: true,
      subscriptionStatus: status.subscriptionStatus,
      user: {
        id: user.id,
        phone: user.phone,
        authMethod: user.authMethod,
        subscriptionStatus: user.subscriptionStatus,
        profileCompleted: user.profileCompleted,
      },
      token,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
