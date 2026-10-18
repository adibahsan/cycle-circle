import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'crypto'
import { prisma } from '../db'
import { ApiError } from '../api-error'
import { env } from '../../utils/env'
import { isDevModeEnabled } from '../dev'
import type { Language } from '../../types'
import { getSubscriptionStatus, isPhoneSubscriberId, isSubscribed, requestOtp, smsSend } from '../adapters/bdapps'
import { createOtpChallenge } from './auth-service'
import { getBdappsSubscriberId } from './subscription-service'

/**
 * App OTP (GLOSSARY): a code we send by SMS to an existing subscriber, because BDApps
 * refuses its own OTP for a subscribed number (E1351). Verifying it logs the user in
 * and never changes their plan (ADR 0002, amendment 2026-10-18).
 */

const OTP_TTL_MS = 5 * 60 * 1000
const APP_OTP_MAX_ATTEMPTS = 5
const APP_OTP_DAILY_CAP = 5

/** Why an existing subscriber can't get an App OTP. */
export type AppOtpFallbackReason = 'no-account' | 'no-masked-id' | 'unregistered'

export type AppOtpStart =
  /** `code` is returned only so the caller can log it (support looks codes up in the logs). */
  | { kind: 'sent'; referenceNo: string; code: string }
  /** No masked subscriber id we can SMS: offer email login (if any) or unsubscribe-and-retry. */
  | { kind: 'fallback'; hasEmail: boolean; reason: AppOtpFallbackReason }

export type LoginOtpRequest = { kind: 'bdapps'; referenceNo: string } | AppOtpStart

function hashCode(referenceNo: string, code: string): string {
  return createHmac('sha256', env.JWT_SECRET).update(`${referenceNo}:${code}`).digest('hex')
}

function smsText(code: string, lang: Language): string {
  return lang === 'bn'
    ? `সাইকেল সার্কেল কোড: ${code}। ৫ মিনিট বৈধ। কাউকে জানাবেন না।`
    : `Cycle Circle code: ${code}. Valid 5 min. Don't share it.`
}

/**
 * Start a phone login: a BDApps OTP for a new number, or an App OTP when BDApps says the
 * number is already subscribed (E1351). Creates the OTP challenge either way.
 */
export async function requestLoginOtp(phone: string, lang: Language): Promise<LoginOtpRequest> {
  let referenceNo: string
  if (isDevModeEnabled()) {
    referenceNo = `dev-${randomUUID()}`
  } else {
    try {
      referenceNo = (await requestOtp(phone)).referenceNo
    } catch (error) {
      if (error instanceof ApiError && error.code === 'ALREADY_SUBSCRIBED') return startAppOtpLogin(phone, lang)
      throw error
    }
  }
  await createOtpChallenge(phone, referenceNo, new Date(Date.now() + OTP_TTL_MS))
  return { kind: 'bdapps', referenceNo }
}

/** On E1351 at login: SMS an App OTP to the user's stored masked subscriber id, if it is live. */
export async function startAppOtpLogin(phone: string, lang: Language): Promise<AppOtpStart> {
  const user = await prisma.user.findUnique({ where: { phone }, select: { id: true, email: true } })
  const hasEmail = Boolean(user?.email)
  if (!user) return { kind: 'fallback', hasEmail, reason: 'no-account' }

  // Raw numbers are rejected by BDApps for our app (E1951), so only a masked id can be SMSed.
  const subscriberId = await getBdappsSubscriberId(user.id)
  if (!subscriberId || isPhoneSubscriberId(subscriberId)) return { kind: 'fallback', hasEmail, reason: 'no-masked-id' }
  if (!isSubscribed(await getSubscriptionStatus(subscriberId))) return { kind: 'fallback', hasEmail, reason: 'unregistered' }

  const sentToday = await prisma.otpChallenge.count({
    where: { phone, codeHash: { not: null }, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  })
  if (sentToday >= APP_OTP_DAILY_CAP) {
    throw new ApiError(429, 'Too many codes sent to this number today. Try again tomorrow.', 'RATE_LIMITED')
  }

  // Save before sending, so a code that reaches the phone can always be verified.
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const referenceNo = `app-${randomUUID()}`
  const challenge = await prisma.otpChallenge.create({
    data: {
      phone,
      referenceNo,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      codeHash: hashCode(referenceNo, code),
      userId: user.id,
    },
  })
  try {
    await smsSend(smsText(code, lang), [subscriberId])
  } catch (error) {
    // Not sent: drop the challenge so it neither blocks a resend nor counts toward the daily cap.
    await prisma.otpChallenge.delete({ where: { id: challenge.id } })
    throw error
  }
  return { kind: 'sent', referenceNo, code }
}

/**
 * Check an App OTP and log the user in. Plan and subscription are untouched: the user
 * is already a subscriber (ADR 0002). Throws the same error codes as the BDApps OTP path.
 */
export async function verifyAppOtp(referenceNo: string, code: string) {
  const challenge = await prisma.otpChallenge.findFirst({ where: { referenceNo } })
  if (!challenge?.codeHash || !challenge.userId) {
    throw new ApiError(404, 'OTP challenge not found', 'CHALLENGE_NOT_FOUND')
  }
  if (challenge.verified) throw new ApiError(400, 'OTP challenge already verified', 'ALREADY_VERIFIED')
  if (new Date() > challenge.expiresAt) throw new ApiError(400, 'OTP challenge has expired', 'CHALLENGE_EXPIRED')
  if (challenge.attempts >= APP_OTP_MAX_ATTEMPTS) {
    throw new ApiError(429, 'Too many wrong codes. Request a new code.', 'OTP_LOCKED')
  }

  if (!appOtpMatches(referenceNo, code, challenge.codeHash)) {
    await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } })
    throw new ApiError(400, 'Invalid OTP code', 'INVALID_OTP')
  }

  // Conditional write so two concurrent verifies of one code can't both log in.
  const { count } = await prisma.otpChallenge.updateMany({
    where: { id: challenge.id, verified: false },
    data: { verified: true },
  })
  if (count === 0) throw new ApiError(400, 'OTP challenge already verified', 'ALREADY_VERIFIED')

  return prisma.user.update({ where: { id: challenge.userId }, data: { lastLoginAt: new Date() } })
}

/** Constant-time check of an App OTP code against its stored hash. */
function appOtpMatches(referenceNo: string, code: string, codeHash: string): boolean {
  const a = Buffer.from(hashCode(referenceNo, code), 'hex')
  const b = Buffer.from(codeHash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}
