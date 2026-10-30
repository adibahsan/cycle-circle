import { withAuth } from '@vesta/shared/server/middleware'
import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { parseSearchParams } from '@vesta/shared/server/validation'
import { getDashboardData } from '@vesta/shared/server/services'
import { z } from 'zod'
import type { AuthUser } from '@vesta/shared/server/auth'

const paramsSchema = z.object({
  profileId: z.string().min(1, 'profileId is required'),
})

export const GET = withAuth(async (request, { user }: { user: AuthUser }) => {
  try {
    const params = await parseSearchParams(request, paramsSchema)
    const data = await getDashboardData(params.profileId, user.id, new Date())
    if (!data) {
      throw new ApiError(404, 'Profile not found', 'PROFILE_NOT_FOUND')
    }
    return Response.json(data)
  } catch (error) {
    return handleApiError(error)
  }
})
