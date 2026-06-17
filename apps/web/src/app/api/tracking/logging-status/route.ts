import { cookies } from 'next/headers'
import { withAuth } from '@vesta/shared/server/middleware'
import { handleApiError } from '@vesta/shared/server/api-error'
import { listProfiles, getLoggingStatus } from '@vesta/shared/server/services'
import type { AuthUser } from '@vesta/shared/server/auth'

export const GET = withAuth(async (_request, { user }: { user: AuthUser }) => {
  try {
    const profiles = await listProfiles(user.id)
    if (profiles.length === 0) {
      return Response.json({ goal: null, loggedToday: false, isPeriodLate: false })
    }
    const cookieId = (await cookies()).get('vesta_active_profile')?.value
    const profileId =
      cookieId && profiles.some((p) => p.id === cookieId) ? cookieId : profiles[0].id
    const status = await getLoggingStatus(profileId, user.id)
    return Response.json(status ?? { goal: null, loggedToday: false, isPeriodLate: false })
  } catch (error) {
    return handleApiError(error)
  }
})
