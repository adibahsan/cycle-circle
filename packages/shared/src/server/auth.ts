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
  peekRateLimit,
  recordRateLimitHit,
} from './adapters/redis'
import { AUDIT_ACTIONS } from './services/audit-actions'
import { log, logger } from './log'
import { z } from 'zod'

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

/**
 * Valid bcrypt hash (cost 12) of a throwaway string. Compared against when the email is
 * unknown / not an admin / has no hash, so every attempt costs one bcrypt compare.
 */
const DUMMY_PASSWORD_HASH = '$2b$12$t9prWBNso.OBZz0.QvUL5OPuoZYLQVtQPhQAWquBgqD1LBwt03vo6'

export async function verifyAdminLogin(email: string, password: string, now: Date): Promise<AuthUser> {
  const bcrypt = await import('bcryptjs')
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })
  const isAdminWithHash = !!user && user.role === 'ADMIN' && !!user.passwordHash
  // Always compare, so response time does not reveal which emails are admins.
  const valid = await bcrypt.compare(password, isAdminWithHash ? user.passwordHash! : DUMMY_PASSWORD_HASH)
  if (!user || !isAdminWithHash || !valid) {
    throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS')
  }
  if (user.suspendedAt) throw new ApiError(403, 'Account suspended', 'ACCOUNT_SUSPENDED')
  if (user.deletedAt) throw new ApiError(401, 'User not found', 'USER_NOT_FOUND')
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: now } })
  return user as AuthUser
}

/** Admin login body: email is trimmed and lowercased. (zod lives here; the admin app does not depend on it.) */
export const adminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
})

const ADMIN_LOGIN_WINDOW_SECONDS = 15 * 60
const ADMIN_LOGIN_EMAIL_LIMIT = 5
const ADMIN_LOGIN_IP_LIMIT = 20

/** Audit write that never throws: auditing must not turn a login/logout into an error. */
async function writeAdminAudit(
  adminId: string,
  action: typeof AUDIT_ACTIONS.ADMIN_LOGIN | typeof AUDIT_ACTIONS.ADMIN_LOGIN_FAILED | typeof AUDIT_ACTIONS.ADMIN_LOGOUT,
  metadata: Record<string, string | undefined>,
): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: { adminId, action, targetType: 'User', targetId: adminId, metadata },
    })
  } catch (err) {
    logger.error('admin.audit_write_failed', err, { action })
  }
}

/** Audits a failed login only when the email belongs to a real ADMIN; otherwise just a warning. */
async function auditFailedAdminLogin(email: string, ip: string | undefined, reason: string): Promise<void> {
  try {
    const admin = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, role: 'ADMIN' },
      select: { id: true },
    })
    if (admin) {
      await writeAdminAudit(admin.id, AUDIT_ACTIONS.ADMIN_LOGIN_FAILED, { ip, reason })
    } else {
      log('customer', { event: 'admin.login_failed.unknown_email', level: 'warn', data: { email, ip, reason } })
    }
  } catch (err) {
    logger.error('admin.audit_lookup_failed', err)
  }
}

/**
 * Admin password login with rate limiting (failed attempts only: 5 per email and 20 per IP
 * per 15 min) and audit rows. `email` must already be trimmed and lowercased.
 */
export async function attemptAdminLogin(input: {
  email: string
  password: string
  ip?: string
  now: Date
}): Promise<AuthUser> {
  const { email, password, ip, now } = input
  const emailKey = `admin-login:email:${email}`
  const ipKey = ip ? `admin-login:ip:${ip}` : null

  const emailPeek = await peekRateLimit(emailKey, ADMIN_LOGIN_EMAIL_LIMIT, ADMIN_LOGIN_WINDOW_SECONDS)
  const ipPeek = ipKey ? await peekRateLimit(ipKey, ADMIN_LOGIN_IP_LIMIT, ADMIN_LOGIN_WINDOW_SECONDS) : null
  if (!emailPeek.allowed || (ipPeek && !ipPeek.allowed)) {
    await auditFailedAdminLogin(email, ip, 'RATE_LIMITED')
    throw new ApiError(429, 'Too many login attempts. Try again later.', 'RATE_LIMITED')
  }

  let user: AuthUser
  try {
    user = await verifyAdminLogin(email, password, now)
  } catch (err) {
    if (err instanceof ApiError && (err.statusCode === 401 || err.statusCode === 403)) {
      if (err.statusCode === 401) {
        await recordRateLimitHit(emailKey, ADMIN_LOGIN_WINDOW_SECONDS)
        if (ipKey) await recordRateLimitHit(ipKey, ADMIN_LOGIN_WINDOW_SECONDS)
      }
      await auditFailedAdminLogin(email, ip, err.statusCode === 403 ? 'SUSPENDED' : 'BAD_PASSWORD')
    }
    throw err
  }
  await writeAdminAudit(user.id, AUDIT_ACTIONS.ADMIN_LOGIN, { ip })
  return user
}

/** Logs the current admin session out, auditing it when there is a valid admin session. */
export async function logoutAdmin(now: Date, ip?: string): Promise<void> {
  const payload = await verifyAuth(ADMIN_AUDIENCE)
  if (payload?.role === 'ADMIN' && payload.sub) {
    await writeAdminAudit(payload.sub, AUDIT_ACTIONS.ADMIN_LOGOUT, { ip })
  }
  await logoutAndBlacklist(now, ADMIN_AUDIENCE)
}

export async function requireAdminAuth(): Promise<JwtPayload> {
  const payload = await requireAuth(ADMIN_AUDIENCE)
  if (payload.role !== 'ADMIN') {
    throw new ApiError(403, 'Admin access required', 'FORBIDDEN')
  }
  return payload
}
