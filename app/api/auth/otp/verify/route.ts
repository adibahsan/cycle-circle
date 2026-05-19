import { z } from 'zod'
import { parseBody } from '@/lib/server/validation'
import { handleApiError, ApiError } from '@/lib/server/api-error'
import { issueJwt, setAuthCookie } from '@/lib/server/auth'
import { verifyOtp } from '@/lib/server/adapters/bdapps'
import { prisma } from '@/lib/server/db'

const bodySchema = z.object({
  referenceNo: z.string().min(1, 'referenceNo is required'),
  otp: z.string().min(1, 'otp is required'),
})

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await parseBody(request, bodySchema)

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
