import { withAuth } from '@vesta/shared/server/middleware'
import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { parseSearchParams } from '@vesta/shared/server/validation'
import { getCalendarData } from '@vesta/shared/server/services'
import { z } from 'zod'
import type { AuthUser } from '@vesta/shared/server/auth'

const paramsSchema = z.object({
  profileId: z.string().min(1, 'profileId is required'),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be in YYYY-MM format'),
})

export const GET = withAuth(async (request, { user }: { user: AuthUser }) => {
  try {
    const params = await parseSearchParams(request, paramsSchema)
    const days = await getCalendarData(params.profileId, user.id, params.month)
    if (!days) {
      throw new ApiError(404, 'Profile not found', 'PROFILE_NOT_FOUND')
    }
    return Response.json({ days })
  } catch (error) {
    return handleApiError(error)
  }
})
