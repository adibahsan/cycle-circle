import { ApiError } from '@vesta/shared/server/api-error'
import { checkRateLimit } from '@vesta/shared/server/adapters/redis'
import { requestIp } from '@vesta/shared/server/request-ip'

/**
 * Per-IP cap on OTP sends, so one machine can't SMS many subscribers. Skipped when the
 * proxy sent no IP, rather than putting every such client in one shared bucket.
 */
export async function assertOtpIpLimit(request: Request): Promise<void> {
  const ip = requestIp(request)
  if (!ip) return
  const rl = await checkRateLimit(`otp:ip:${ip}`, 10, 60 * 60)
  if (!rl.allowed) {
    throw new ApiError(429, 'Too many OTP requests from this device. Try again later.', 'RATE_LIMITED')
  }
}
