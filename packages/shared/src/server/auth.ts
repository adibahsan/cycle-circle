import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { prisma } from './db'
import { env } from '../utils/env'
import { ApiError } from './api-error'
import { blacklistJti, isJtiBlacklisted } from './adapters/redis'

const COOKIE_NAME = 'vesta_token'
const JWT_EXPIRY_SECONDS = 60 * 60 * 24 * 30 // 30 days

function secret() {
  return new TextEncoder().encode(env.JWT_SECRET)
}

export interface JwtPayload {
  sub: string
  phone?: string
  email?: string
  role?: string
  jti?: string
  iat?: number
  exp?: number
}

export async function issueJwt(payload: {
  sub: string
  phone?: string
  email?: string
  role?: string
}): Promise<string> {
  const jti = crypto.randomUUID()
  const token = await new SignJWT({
    phone: payload.phone,
    email: payload.email,
    role: payload.role ?? 'USER',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(`${JWT_EXPIRY_SECONDS}s`)
    .sign(secret())

  return token
}

export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: JWT_EXPIRY_SECONDS,
    path: '/',
  })
}

export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function verifyAuth(): Promise<JwtPayload | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null

    const { payload } = await jwtVerify(token, secret())
    const jti = payload.jti as string | undefined
    if (jti && (await isJtiBlacklisted(jti))) return null

    return payload as JwtPayload
  } catch {
    return null
  }
}

export async function requireAuth(): Promise<JwtPayload> {
  const payload = await verifyAuth()
  if (!payload) {
    throw new ApiError(401, 'Unauthorized', 'UNAUTHORIZED')
  }
  return payload
}

export async function logoutAndBlacklist(): Promise<void> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (token) {
      const { payload } = await jwtVerify(token, secret())
      const jti = payload.jti as string | undefined
      const exp = payload.exp as number | undefined
      if (jti && exp) {
        const ttl = Math.max(0, exp - Math.floor(Date.now() / 1000))
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

export async function verifyAdminLogin(email: string, password: string): Promise<AuthUser> {
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
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
  return user as AuthUser
}

export async function requireAdminAuth(): Promise<JwtPayload> {
  const payload = await requireAuth()
  if (payload.role !== 'ADMIN') {
    throw new ApiError(403, 'Admin access required', 'FORBIDDEN')
  }
  return payload
}
