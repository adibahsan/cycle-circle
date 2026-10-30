import { z } from 'zod'
import { parseBody } from '@vesta/shared/server/validation'
import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { WEB_AUDIENCE, issueJwt, setAuthCookie, validateMsisdn } from '@vesta/shared/server/auth'
import { upsertUserByPhone } from '@vesta/shared/server/services'
import { isDevModeEnabled } from '@vesta/shared/server/dev'
import { withRequestContext, setRequestUser, logger } from '@vesta/shared/server/log'
import { logCustomerRefusal } from '@/app/api/auth/log-failure'

function mapPartialAuthUser(raw: {
  id: string
  phone?: string | null
  profileCompleted: boolean
  subscriptionStatus: string
}) {
  return {
    id: raw.id,
    phone: String(raw.phone ?? '').replace(/^\+/, ''),
    authMethod: 'otp' as const,
    subscriptionStatus: raw.subscriptionStatus.toLowerCase() as 'free' | 'pro',
    language: 'en' as const,
    profileCompleted: Boolean(raw.profileCompleted),
    fullName: '',
    createdAt: new Date().toISOString(),
  }
}

const bodySchema = z.object({
  phone: z.string().min(1, 'Phone is required'),
})

export async function POST(request: Request): Promise<Response> {
  return withRequestContext(async () => {
  try {
    if (!isDevModeEnabled()) {
      throw new ApiError(403, 'Dev login is not available', 'DEV_MODE_DISABLED')
    }

    const body = await parseBody(request, bodySchema)
    const normalizedPhone = validateMsisdn(body.phone)

    const user = await upsertUserByPhone(normalizedPhone, new Date())
    setRequestUser(user.id)

    const token = await issueJwt({
      sub: user.id,
      phone: user.phone ?? undefined,
      role: user.role,
    }, WEB_AUDIENCE)
    await setAuthCookie(token)

    const mapped = mapPartialAuthUser({
      id: user.id,
      phone: user.phone,
      profileCompleted: user.profileCompleted,
      subscriptionStatus: user.subscriptionStatus,
    })

    logger.customer('auth.dev-login', { phone: normalizedPhone, ok: true })
    return Response.json({ user: mapped, token })
  } catch (error) {
    logCustomerRefusal('auth.dev-login', error)
    return handleApiError(error)
  }
  }, { requestId: request.headers.get('x-request-id') ?? undefined })
}
