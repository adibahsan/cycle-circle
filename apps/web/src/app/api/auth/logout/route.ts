import { cookies } from 'next/headers'
import { handleApiError } from '@vesta/shared/server/api-error'
import { logoutAndBlacklist, verifyAuth } from '@vesta/shared/server/auth'
import { withRequestContext, setRequestUser, logger } from '@vesta/shared/server/log'

export async function POST(request: Request): Promise<Response> {
  return withRequestContext(async () => {
    try {
      // Read the session before it is blacklisted so the line carries the user.
      const jwt = await verifyAuth()
      if (jwt) setRequestUser(jwt.sub)
      await logoutAndBlacklist(new Date())
      const cookieStore = await cookies()
      cookieStore.delete('vesta_active_profile')
      logger.customer('auth.logout', { ok: true, hadSession: Boolean(jwt) })
      return Response.json({ message: 'Logged out' })
    } catch (error) {
      return handleApiError(error)
    }
  }, { requestId: request.headers.get('x-request-id') ?? undefined })
}
