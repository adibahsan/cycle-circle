import { z } from 'zod'
import { parseBody } from '@vesta/shared/server/validation'
import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { validateMsisdn } from '@vesta/shared/server/auth'
import { checkRateLimit } from '@vesta/shared/server/adapters/redis'
import { requestOtp } from '@vesta/shared/server/adapters/bdapps'
import { createOtpChallenge } from '@vesta/shared/server/services'
import { isDevModeEnabled } from '@vesta/shared/server/dev'

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

    let referenceNo: string

    if (isDevModeEnabled()) {
      referenceNo = `dev-${crypto.randomUUID()}`
    } else {
      const result = await requestOtp(normalizedPhone)
      referenceNo = result.referenceNo
    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
    await createOtpChallenge(normalizedPhone, referenceNo, expiresAt)

    return Response.json({ referenceNo, message: 'OTP sent' })
  } catch (error) {
    return handleApiError(error)
  }
}
