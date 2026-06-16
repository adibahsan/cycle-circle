import { withAuth } from '@vesta/shared/server/middleware'
import { handleApiError } from '@vesta/shared/server/api-error'
import { getProfileCompletionStatus } from '@vesta/shared/server/services'
import type { AuthUser } from '@vesta/shared/server/auth'

export const GET = withAuth(async (_request, { user }: { user: AuthUser }) => {
  try {
    const status = await getProfileCompletionStatus(user.id)
    return Response.json(status)
  } catch (error) {
    return handleApiError(error)
  }
})
