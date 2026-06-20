import { withAuth } from '@vesta/shared/server/middleware'
import { handleApiError } from '@vesta/shared/server/api-error'
import { getUserById } from '@vesta/shared/server/services'
import type { AuthUser } from '@vesta/shared/server/auth'

export const GET = withAuth(async (_request, { user }: { user: AuthUser }) => {
  try {
    const dbUser = await getUserById(user.id)
    return Response.json({ user: dbUser })
  } catch (error) {
    return handleApiError(error)
  }
}, { allowExpiredTrial: true })
