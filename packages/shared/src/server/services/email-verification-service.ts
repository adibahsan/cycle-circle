import { createHmac, randomInt, timingSafeEqual } from 'crypto'
import { z } from 'zod'
import { prisma } from '../db'
import { ApiError } from '../api-error'
import { env } from '../../utils/env'
import { normalizeEmail } from '../../utils/email'
import { DEV_OTP_CODES } from '../../utils/config'
import { isDevModeEnabled } from '../dev'
import { sendVerificationCodeEmail } from '../adapters/mail'
import { OTP_RESEND_COOLDOWN_SECONDS, otpCooldownRemaining } from './auth-service'
import { assertContactAvailable } from './user-service'

/**
 * Email verification (GLOSSARY: contact): a 6-digit code mailed to the address a signed-in
 * user wants to add or change. The address is written to `User.email` only after the right
 * code comes back, so nobody can claim an inbox they don't own.
 */

export const EMAIL_CODE_TTL_MS = 10 * 60 * 1000
export const EMAIL_CODE_MAX_ATTEMPTS = 5

const emailSchema = z.string().email()

function hashCode(userId: string, email: string, code: string): string {
  return createHmac('sha256', env.JWT_SECRET).update(`email:${userId}:${email}:${code}`).digest('hex')
}

function codeMatches(userId: string, email: string, code: string, codeHash: string): boolean {
  const a = Buffer.from(hashCode(userId, email, code), 'hex')
  const b = Buffer.from(codeHash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Seconds until this user may ask for another code (0 = now). */
export async function getEmailCodeCooldownRemaining(userId: string, now: Date): Promise<number> {
  const last = await prisma.emailVerification.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  return otpCooldownRemaining(last?.createdAt ?? null, now.getTime(), OTP_RESEND_COOLDOWN_SECONDS)
}

/**
 * Mail a verification code to `rawEmail`. Returns the normalised address and the code
 * (the caller may log the code in dev only).
 */
export async function requestEmailVerification(userId: string, rawEmail: string, now: Date) {
  const email = normalizeEmail(rawEmail)
  if (!emailSchema.safeParse(email).success) {
    throw new ApiError(400, 'Enter a valid email address', 'INVALID_EMAIL')
  }
  await assertContactAvailable(userId, { email })

  const cooldown = await getEmailCodeCooldownRemaining(userId, now)
  if (cooldown > 0) {
    throw new ApiError(429, `Please wait ${cooldown}s before requesting a new code.`, 'OTP_COOLDOWN')
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { language: true } })
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')

  // Save before sending, so a code that reaches the inbox can always be verified.
  const challenge = await prisma.emailVerification.create({
    data: {
      userId,
      email,
      codeHash: hashCode(userId, email, code),
      expiresAt: new Date(now.getTime() + EMAIL_CODE_TTL_MS),
    },
  })
  try {
    await sendVerificationCodeEmail(email, code, user?.language === 'BN' ? 'bn' : 'en', userId)
  } catch (error) {
    // Not sent: drop it so it neither blocks a retry nor can be guessed.
    await prisma.emailVerification.delete({ where: { id: challenge.id } })
    throw error
  }
  // Only the newest code can be used.
  await prisma.emailVerification.deleteMany({
    where: { userId, verified: false, id: { not: challenge.id } },
  })
  return { email, code }
}

/** Check the code for the user's latest request and save the email. Returns the saved address. */
export async function verifyEmailCode(userId: string, code: string, now: Date): Promise<{ email: string }> {
  const challenge = await prisma.emailVerification.findFirst({
    where: { userId, verified: false },
    orderBy: { createdAt: 'desc' },
  })
  if (!challenge) throw new ApiError(404, 'No verification code found. Request a new one.', 'CHALLENGE_NOT_FOUND')
  if (now > challenge.expiresAt) {
    throw new ApiError(400, 'Verification code has expired', 'CHALLENGE_EXPIRED')
  }
  if (challenge.attempts >= EMAIL_CODE_MAX_ATTEMPTS) {
    throw new ApiError(429, 'Too many wrong codes. Request a new code.', 'OTP_LOCKED')
  }

  const ok =
    codeMatches(userId, challenge.email, code, challenge.codeHash) ||
    (isDevModeEnabled() && DEV_OTP_CODES.includes(code))
  if (!ok) {
    await prisma.emailVerification.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } })
    throw new ApiError(400, 'Invalid verification code', 'INVALID_OTP')
  }

  // Someone may have taken the address since the code was sent.
  await assertContactAvailable(userId, { email: challenge.email })

  try {
    await prisma.$transaction(async (tx) => {
      // Conditional claim so two concurrent verifies of one code can't both save.
      const { count } = await tx.emailVerification.updateMany({
        where: { id: challenge.id, verified: false },
        data: { verified: true },
      })
      if (count === 0) throw new ApiError(404, 'No verification code found. Request a new one.', 'CHALLENGE_NOT_FOUND')
      await tx.user.update({ where: { id: userId }, data: { email: challenge.email } })
    })
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') {
      throw new ApiError(409, 'Email already registered to another account', 'EMAIL_TAKEN')
    }
    throw e
  }
  return { email: challenge.email }
}
