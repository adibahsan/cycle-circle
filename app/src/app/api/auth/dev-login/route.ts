import { z } from 'zod'
import { parseBody } from '@/server/validation'
import { handleApiError, ApiError } from '@/server/api-error'
import { issueJwt, setAuthCookie, validateMsisdn } from '@/server/auth'
import { prisma } from '@/server/db'
import { isDevModeEnabled } from '@/server/dev'
import { mapPartialAuthUser } from '@/lib/api-mappers'

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

    const user = await prisma.user.upsert({
      where: { phone: normalizedPhone },
      create: {
        phone: normalizedPhone,
        authMethod: 'OTP',
      },
      update: {},
    })

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
