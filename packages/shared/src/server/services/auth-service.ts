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

  await prisma.otpChallenge.update({
    where: { id: challengeId },
    data: { userId: user.id },
  })

  return user
}

export async function upsertUserByPhone(phone: string) {
  return prisma.user.upsert({
    where: { phone },
    create: {
      phone,
      authMethod: 'OTP',
      lastLoginAt: new Date(),
    },
    update: { lastLoginAt: new Date() },
  })
}
