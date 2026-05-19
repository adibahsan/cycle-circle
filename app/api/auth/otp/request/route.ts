import { z } from 'zod'
import { parseBody } from '@/lib/server/validation'
import { handleApiError, ApiError } from '@/lib/server/api-error'
import { validateMsisdn } from '@/lib/server/auth'
import { checkRateLimit } from '@/lib/server/adapters/redis'
import { requestOtp } from '@/lib/server/adapters/bdapps'
import { prisma } from '@/lib/server/db'

const bodySchema = z.object({
  phone: z.string().min(1, 'Phone is required'),
})

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await parseBody(request, bodySchema)

    const normalizedPhone = validateMsisdn(body.phone)

    const rl = await checkRateLimit(`otp:${normalizedPhone}`, 3, 60)
    if (!rl.allowed) {
      throw new ApiError(429, 'Too many OTP requests. Try again in a minute.', 'RATE_LIMITED')
    }

    const result = await requestOtp(normalizedPhone)

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
    await prisma.otpChallenge.create({
      data: {
        phone: normalizedPhone,
        referenceNo: result.referenceNo,
        expiresAt,
      },
    })

    return Response.json({ referenceNo: result.referenceNo, message: 'OTP sent' })
  } catch (error) {
    return handleApiError(error)
  }
}
