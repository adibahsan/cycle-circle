import { z } from 'zod'
import { parseBody } from '@vesta/shared/server/validation'
import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { issueJwt, setAuthCookie, validateMsisdn } from '@vesta/shared/server/auth'
import { upsertUserByPhone } from '@vesta/shared/server/services'
import { isDevModeEnabled } from '@vesta/shared/server/dev'

function mapPartialAuthUser(raw: {
  id: string
  phone?: string | null
  profileCompleted: boolean
}) {
  return {
    id: raw.id,
    phone: String(raw.phone ?? '').replace(/^tel:/, ''),
    authMethod: 'otp' as const,
    subscriptionStatus: 'free' as const,
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
  try {
    if (!isDevModeEnabled()) {
      throw new ApiError(403, 'Dev login is not available', 'DEV_MODE_DISABLED')
    }

    const body = await parseBody(request, bodySchema)
    const normalizedPhone = validateMsisdn(body.phone)

    const user = await upsertUserByPhone(normalizedPhone)

    const token = await issueJwt({
      sub: user.id,
      phone: user.phone ?? undefined,
      role: user.role,
    })
    await setAuthCookie(token)

    const mapped = mapPartialAuthUser({
      id: user.id,
      phone: user.phone,
      profileCompleted: user.profileCompleted,
    })

    return Response.json({ user: mapped, token })
  } catch (error) {
    return handleApiError(error)
  }
}
