import { timingSafeEqual } from 'crypto'
import { requireAuth, requireAdminAuth, getAuthUser, AuthUser } from './auth'
import { handleApiError, ApiError } from './api-error'
import { env } from '../utils/env'
import { isTrialExpired } from '../utils/trial'

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

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
export function withAuth(handler: AuthedHandler, opts?: { allowExpiredTrial?: boolean }) {
  return async (request: Request, context: RouteContext): Promise<Response> => {
    try {
      const jwt = await requireAuth()
      const user = await getAuthUser(jwt.sub)

      if (!opts?.allowExpiredTrial && isTrialExpired(user)) {
        throw new ApiError(402, 'Email trial has expired. Please upgrade to PRO.', 'TRIAL_EXPIRED')
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
      if (!env.CRON_SECRET || !token || !safeEqual(token, env.CRON_SECRET)) {
        throw new ApiError(401, 'Invalid cron secret', 'UNAUTHORIZED')
      }
      return handler(request)
    } catch (error) {
      return handleApiError(error)
    }
  }
}

/**
 * Wraps a route handler with admin authentication.
 * Verifies JWT, fetches the user, and enforces role === 'ADMIN'.
 */
export function withAdminAuth(handler: AuthedHandler) {
  return async (request: Request, context: RouteContext): Promise<Response> => {
    try {
      const jwt = await requireAdminAuth()
      const user = await getAuthUser(jwt.sub)
      if (user.role !== 'ADMIN') {
        throw new ApiError(403, 'Admin access required', 'FORBIDDEN')
      }
      return handler(request, { ...context, user })
    } catch (error) {
      return handleApiError(error)
    }
  }
}
