import { cookies } from 'next/headers'
import { prisma } from './db'
import { env } from '../utils/env'
import {
  ADMIN_AUDIENCE,
  WEB_AUDIENCE,
  signAuthToken,
  verifyAuthToken,
  type AuthAudience,
} from '../utils/auth-token'
import { ApiError } from './api-error'
import {
  blacklistJti,
  isJtiBlacklisted,
  getSessionsValidAfterCache,
  setSessionsValidAfterCache,
} from './adapters/redis'

const COOKIE_NAME = env.AUTH_COOKIE_NAME
const JWT_EXPIRY_SECONDS = 60 * 60 * 24 * 30 // 30 days (web app)
export const ADMIN_JWT_EXPIRY_SECONDS = 60 * 60 * 24 * 7 // 7 days (admin app)

export { ADMIN_AUDIENCE, WEB_AUDIENCE, type AuthAudience }

export interface JwtPayload {
  sub: string
  phone?: string
  email?: string
  role?: string
  jti?: string
  iat?: number
  exp?: number
}

/**
 * Signs a session token for one app. `audience` is required: the caller (web login
 * routes vs admin login) decides which app may accept the token.
 */
export async function issueJwt(payload: {
  sub: string
  phone?: string
  email?: string
  role?: string
}, audience: AuthAudience, expirySeconds: number = JWT_EXPIRY_SECONDS): Promise<string> {
  return signAuthToken(payload, audience, expirySeconds)
}

export async function setAuthCookie(token: string, maxAgeSeconds: number = JWT_EXPIRY_SECONDS): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: maxAgeSeconds,
    path: '/',
  })
}

export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

/**
 * Verifies the session cookie for one app. Defaults to the web audience; the admin app
 * must pass ADMIN_AUDIENCE (requireAdminAuth does). A token for the other app, from
 * another environment, or without `aud`/`iss` is rejected.
 */
export async function verifyAuth(audience: AuthAudience = WEB_AUDIENCE): Promise<JwtPayload | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null

    const payload = await verifyAuthToken(token, audience)
    const jti = payload.jti as string | undefined
    if (jti && (await isJtiBlacklisted(jti))) return null
    if (payload.sub && (await isIssuedBeforeSessionsValidAfter(payload.sub, payload.iat))) return null

    return payload as JwtPayload
  } catch {
    return null
  }
}

/**
 * True when a token (JWT `iat`, seconds) predates the user's sessions-valid-after
 * marker (epoch ms; 0/null = none). Fail-closed on the boundary second: a token
 * issued in the same second as the marker is rejected.
 */
export function isIssuedBeforeMarker(iat: number | undefined, markerMs: number | null): boolean {
  if (!markerMs) return false
  return (iat ?? 0) <= Math.floor(markerMs / 1000)
}

/** Marker lookup: session store (Redis) first, database fallback (then re-cached). */
async function isIssuedBeforeSessionsValidAfter(userId: string, iat: number | undefined): Promise<boolean> {
  let markerMs = await getSessionsValidAfterCache(userId)
  if (markerMs === null) {
    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { sessionsValidAfter: true },
    })
    markerMs = row?.sessionsValidAfter?.getTime() ?? 0
    await setSessionsValidAfterCache(userId, markerMs)
  }
  return isIssuedBeforeMarker(iat, markerMs)
}

/**
 * Invalidate every existing session of a user: all tokens issued up to now are
 * rejected by verifyAuth on their next request (web and admin). Reusable by any
 * flow that ends access (suspend, delete, BDApps unsubscribe).
 */
export async function bumpSessionsValidAfter(userId: string, now: Date): Promise<Date> {
  await prisma.user.update({ where: { id: userId }, data: { sessionsValidAfter: now } })
  await setSessionsValidAfterCache(userId, now.getTime())
  return now
}

export async function requireAuth(audience: AuthAudience = WEB_AUDIENCE): Promise<JwtPayload> {
  const payload = await verifyAuth(audience)
  if (!payload) {
    throw new ApiError(401, 'Unauthorized', 'UNAUTHORIZED')
  }
  return payload
}

export async function logoutAndBlacklist(now: Date, audience: AuthAudience = WEB_AUDIENCE): Promise<void> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (token) {
      const payload = await verifyAuthToken(token, audience)
      const jti = payload.jti as string | undefined
      const exp = payload.exp as number | undefined
      if (jti && exp) {
        const ttl = Math.max(0, exp - Math.floor(now.getTime() / 1000))
        await blacklistJti(jti, ttl)
      }
    }
  } catch {
    // Ignore errors on logout — still clear the cookie
  }
  await clearAuthCookie()
}

/**
 * Validates a Bangladeshi MSISDN. Accepts formats:
 *   01XXXXXXXXX, 8801XXXXXXXXX, +8801XXXXXXXXX, tel:8801XXXXXXXXX
 * Returns the normalized +88 international format for DB storage.
 */
export function validateMsisdn(phone: string): string {
  const cleaned = phone.replace(/\s+/g, '')
  const match = cleaned.match(/^(?:\+?88|tel:88)?0?(1[3-9]\d{8})$/)
  if (!match) {
    throw new ApiError(400, 'Invalid Bangladeshi phone number', 'INVALID_PHONE')
  }
  return `+880${match[1]}`
}

export interface AuthUser {
  id: string
  phone: string | null
  email: string | null
  fullName: string | null
  authMethod: string
  subscriptionStatus: string
  profileCompleted: boolean
  emailTrialExpiresAt: Date | null
  role: string
  suspendedAt: Date | null
  deletedAt: Date | null
  profileReminderOptOut: boolean
  onboardingTourCompletedAt: Date | null
}

export async function getAuthUser(userId: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new ApiError(401, 'User not found', 'USER_NOT_FOUND')
  if (user.suspendedAt) throw new ApiError(403, 'Account suspended', 'ACCOUNT_SUSPENDED')
  if (user.deletedAt) throw new ApiError(401, 'User not found', 'USER_NOT_FOUND')
  return user as AuthUser
}

export async function verifyAdminLogin(email: string, password: string, now: Date): Promise<AuthUser> {
  const bcrypt = await import('bcryptjs')
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || user.role !== 'ADMIN' || !user.passwordHash) {
    throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS')
  }
  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS')
  }
  if (user.suspendedAt) throw new ApiError(403, 'Account suspended', 'ACCOUNT_SUSPENDED')
  if (user.deletedAt) throw new ApiError(401, 'User not found', 'USER_NOT_FOUND')
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: now } })
  return user as AuthUser
}

export async function requireAdminAuth(): Promise<JwtPayload> {
  const payload = await requireAuth(ADMIN_AUDIENCE)
  if (payload.role !== 'ADMIN') {
    throw new ApiError(403, 'Admin access required', 'FORBIDDEN')
  }
  return payload
}
