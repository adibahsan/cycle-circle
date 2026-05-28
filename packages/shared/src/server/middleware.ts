import { requireAuth, getAuthUser, AuthUser } from './auth'
import { handleApiError, ApiError } from './api-error'
import { env } from '../utils/env'

export type AuthedRequest = Request & { user: AuthUser }

type RouteContext = { params: Promise<Record<string, string>> }

type AuthedHandler = (
  request: Request,
  context: RouteContext & { user: AuthUser },
) => Promise<Response>

/**
 * Wraps a route handler with JWT authentication.
 * Injects `user` into the context object.
 * Also enforces email trial expiry for EMAIL auth users.
 */
export function withAuth(handler: AuthedHandler) {
  return async (request: Request, context: RouteContext): Promise<Response> => {
    try {
      const jwt = await requireAuth()
      const user = await getAuthUser(jwt.sub)

      // Email trial enforcement: if trial has expired and user is still FREE, block
      if (
        user.authMethod === 'EMAIL' &&
        user.emailTrialExpiresAt &&
        new Date() > user.emailTrialExpiresAt &&
        user.subscriptionStatus === 'FREE'
      ) {
        throw new ApiError(
          402,
          'Email trial has expired. Please upgrade to PRO.',
          'TRIAL_EXPIRED',
        )
      }

      return handler(request, { ...context, user })
    } catch (error) {
      return handleApiError(error)
    }
  }
}

/**
 * Wraps a cron route handler with shared-secret authentication.
 * Expects `Authorization: Bearer <CRON_SECRET>` header.
 */
export function withCronAuth(handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    try {
      const authHeader = request.headers.get('authorization') ?? ''
      const [, token] = authHeader.split(' ')
      if (!token || token !== env.CRON_SECRET) {
        throw new ApiError(401, 'Invalid cron secret', 'UNAUTHORIZED')
      }
      return handler(request)
    } catch (error) {
      return handleApiError(error)
    }
  }
}
