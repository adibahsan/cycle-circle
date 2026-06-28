import { prisma } from '../db'

export async function createMagicLink(email: string, token: string, expiresAt: Date) {
  return prisma.magicLink.create({
    data: { email, token, expiresAt },
  })
}

export async function findMagicLink(token: string) {
  return prisma.magicLink.findUnique({ where: { token } })
}

export async function completeMagicLinkAuth(magicLinkId: string, email: string) {
  await prisma.magicLink.update({
    where: { id: magicLinkId },
    data: { used: true },
  })

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      authMethod: 'EMAIL',
      emailTrialExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      lastLoginAt: new Date(),
    },
    update: { lastLoginAt: new Date() },
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
  cooldownSeconds: number = OTP_RESEND_COOLDOWN_SECONDS,
): Promise<number> {
  const last = await prisma.otpChallenge.findFirst({
    where: { phone },
    orderBy: { createdAt: 'desc' },
  })
  return otpCooldownRemaining(last?.createdAt ?? null, Date.now(), cooldownSeconds)
}

export async function findOtpChallenge(referenceNo: string) {
  return prisma.otpChallenge.findFirst({
    where: { referenceNo },
  })
}

export async function completeOtpAuth(challengeId: string, phone: string) {
  await prisma.otpChallenge.update({
    where: { id: challengeId },
    data: { verified: true },
  })

  const user = await prisma.user.upsert({
    where: { phone },
    create: {
      phone,
      authMethod: 'OTP',
      lastLoginAt: new Date(),
    },
    update: { lastLoginAt: new Date() },
  })

  // OTP/phone users are Pro by default — unless an admin explicitly set their status.
  if (user.subscriptionStatus !== 'PRO') {
    const override = await prisma.subscription.findFirst({
      where: { userId: user.id, adminOverride: true },
      select: { id: true },
    })
    if (!override) {
      await prisma.user.update({ where: { id: user.id }, data: { subscriptionStatus: 'PRO' } })
      user.subscriptionStatus = 'PRO'
    }
  }

  await prisma.otpChallenge.update({
    where: { id: challengeId },
    data: { userId: user.id },
  })

  return user
}

export async function upsertUserByPhone(phone: string) {
  const user = await prisma.user.upsert({
    where: { phone },
    create: {
      phone,
      authMethod: 'OTP',
      lastLoginAt: new Date(),
    },
    update: { lastLoginAt: new Date() },
  })

  // OTP/phone users are Pro by default — unless an admin explicitly set their status.
  if (user.subscriptionStatus !== 'PRO') {
    const override = await prisma.subscription.findFirst({
      where: { userId: user.id, adminOverride: true },
      select: { id: true },
    })
    if (!override) {
      await prisma.user.update({ where: { id: user.id }, data: { subscriptionStatus: 'PRO' } })
      user.subscriptionStatus = 'PRO'
    }
  }

  return user
}
