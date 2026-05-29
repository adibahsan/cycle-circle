import { z } from 'zod'
import { parseBody } from '@vesta/shared/server/validation'
import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { issueJwt, setAuthCookie } from '@vesta/shared/server/auth'
import { verifyOtp } from '@vesta/shared/server/adapters/bdapps'
import { checkRateLimit } from '@vesta/shared/server/adapters/redis'
import { prisma } from '@vesta/shared'

const bodySchema = z.object({
  referenceNo: z.string().min(1, 'referenceNo is required'),
  otp: z.string().min(1, 'otp is required'),
})

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await parseBody(request, bodySchema)

    const rl = await checkRateLimit(`otp:verify:${body.referenceNo}`, 5, 300)
    if (!rl.allowed) {
      throw new ApiError(429, 'Too many verification attempts. Try again later.', 'RATE_LIMITED')
    }

    const challenge = await prisma.otpChallenge.findFirst({
      where: { referenceNo: body.referenceNo },
    })

    if (!challenge) {
      throw new ApiError(404, 'OTP challenge not found', 'CHALLENGE_NOT_FOUND')
    }
    if (challenge.verified) {
      throw new ApiError(400, 'OTP challenge already verified', 'ALREADY_VERIFIED')
    }
    if (new Date() > challenge.expiresAt) {
      throw new ApiError(400, 'OTP challenge has expired', 'CHALLENGE_EXPIRED')
    }

    await verifyOtp(body.referenceNo, body.otp)

    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { verified: true },
    })

    const user = await prisma.user.upsert({
      where: { phone: challenge.phone },
      create: {
        phone: challenge.phone,
        authMethod: 'OTP',
      },
      update: {},
    })

    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { userId: user.id },
    })

    const token = await issueJwt({
      sub: user.id,
      phone: user.phone ?? undefined,
      role: user.role,
    })
    await setAuthCookie(token)

    return Response.json({
      user: {
        id: user.id,
        phone: user.phone,
        profileCompleted: user.profileCompleted,
      },
      token,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
