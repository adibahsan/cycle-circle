import { prisma } from '../db'
import { applyBdappsSubscription } from './subscription-service'

/** `language` is the requesting page's choice; omit it when none was made (#258). */
export async function createMagicLink(email: string, token: string, expiresAt: Date, language?: 'en' | 'bn') {
  return prisma.magicLink.create({
    data: { email, token, expiresAt, language: language ? (language === 'bn' ? 'BN' : 'EN') : undefined },
  })
}

export async function findMagicLink(token: string) {
  return prisma.magicLink.findUnique({ where: { token } })
}

export async function completeMagicLinkAuth(magicLinkId: string, email: string, now: Date) {
  await prisma.magicLink.update({
    where: { id: magicLinkId },
    data: { used: true },
  })

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      authMethod: 'EMAIL',
      emailTrialExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      lastLoginAt: now,
    },
    update: { lastLoginAt: now },
  })

  await prisma.magicLink.update({
    where: { id: magicLinkId },
    data: { userId: user.id },
  })

  return user
}

export async function createOtpChallenge(phone: string, referenceNo: string, expiresAt: Date) {
  return prisma.otpChallenge.create({
    data: { phone, referenceNo, expiresAt },
  })
}

/** SRS FR-AUTH: OTP resend is only offered after a 60-second cooldown. */
export const OTP_RESEND_COOLDOWN_SECONDS = 60

/**
 * Pure cooldown math: seconds remaining before another OTP may be requested,
 * given the timestamp of the most recent challenge (null = none yet → allowed).
 */
export function otpCooldownRemaining(
  lastCreatedAt: Date | null,
  nowMs: number,
  cooldownSeconds: number = OTP_RESEND_COOLDOWN_SECONDS,
): number {
  if (!lastCreatedAt) return 0
  const remainingMs = cooldownSeconds * 1000 - (nowMs - lastCreatedAt.getTime())
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0
}

/**
 * Server-side resend cooldown: returns seconds remaining for the given phone
 * based on its most recent OtpChallenge. The OtpChallenge table is the source
 * of truth, so this works regardless of Redis availability. 0 = may request.
 */
export async function getOtpResendCooldownRemaining(
  phone: string,
  now: Date,
  cooldownSeconds: number = OTP_RESEND_COOLDOWN_SECONDS,
): Promise<number> {
  const last = await prisma.otpChallenge.findFirst({
    where: { phone },
    orderBy: { createdAt: 'desc' },
  })
  return otpCooldownRemaining(last?.createdAt ?? null, now.getTime(), cooldownSeconds)
}

export async function findOtpChallenge(referenceNo: string) {
  return prisma.otpChallenge.findFirst({
    where: { referenceNo },
  })
}

export async function completeOtpAuth(
  challengeId: string,
  phone: string,
  registered: boolean,
  now: Date,
  /** BDApps subscriberId from otp/verify (masked `tel:<id>`); defaults to the phone. */
  subscriberId: string = phone,
) {
  await prisma.otpChallenge.update({
    where: { id: challengeId },
    data: { verified: true },
  })

  const user = await prisma.user.upsert({
    where: { phone },
    create: {
      phone,
      authMethod: 'OTP',
      lastLoginAt: now,
    },
    update: { lastLoginAt: now },
  })

  // A BDApps-verified phone login is the subscription (ADR 0002). Admin overrides win.
  user.subscriptionStatus = await applyBdappsSubscription(user.id, subscriberId, registered, 'otp-verify')

  await prisma.otpChallenge.update({
    where: { id: challengeId },
    data: { userId: user.id },
  })

  return user
}

export async function upsertUserByPhone(phone: string, now: Date) {
  const user = await prisma.user.upsert({
    where: { phone },
    create: {
      phone,
      authMethod: 'OTP',
      lastLoginAt: now,
    },
    update: { lastLoginAt: now },
  })

  // Dev login stands in for a registered BDApps subscriber (ADR 0002): create the
  // Subscription row like a real login, unless an admin override wins.
  user.subscriptionStatus = await applyBdappsSubscription(user.id, phone, true, 'dev-login')

  return user
}
