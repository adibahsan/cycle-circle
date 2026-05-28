import { handleApiError } from '@vesta/shared/server/api-error'
import { logoutAndBlacklist } from '@vesta/shared/server/auth'

export async function POST(_request: Request): Promise<Response> {
  try {
    await logoutAndBlacklist()
    return Response.json({ message: 'Logged out' })
  } catch (error) {
    return handleApiError(error)
  }
}
