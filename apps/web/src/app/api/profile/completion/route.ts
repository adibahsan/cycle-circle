import { cookies } from 'next/headers'
import { withAuth } from '@vesta/shared/server/middleware'
import { handleApiError } from '@vesta/shared/server/api-error'
import { getProfileCompletionStatus, listProfiles } from '@vesta/shared/server/services'
import type { AuthUser } from '@vesta/shared/server/auth'

export const GET = withAuth(async (_request, { user }: { user: AuthUser }) => {
  try {
    // Same active-profile resolution as /api/tracking/logging-status, so the shell's
    // completion ring and the dashboard agree after a profile switch.
    const cookieId = (await cookies()).get('vesta_active_profile')?.value
    const profileId = cookieId && (await listProfiles(user.id)).some((p) => p.id === cookieId) ? cookieId : undefined
    const status = await getProfileCompletionStatus(user.id, profileId)
    return Response.json(status)
  } catch (error) {
    return handleApiError(error)
  }
})
