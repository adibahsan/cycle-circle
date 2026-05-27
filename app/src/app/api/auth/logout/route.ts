import { handleApiError } from '@/server/api-error'
import { logoutAndBlacklist } from '@/server/auth'

export async function POST(_request: Request): Promise<Response> {
  try {
    await logoutAndBlacklist()
    return Response.json({ message: 'Logged out' })
  } catch (error) {
    return handleApiError(error)
  }
}
