import { ApiError } from '@vesta/shared/server/api-error'
import { checkRateLimit } from '@vesta/shared/server/adapters/redis'

/** Our nginx overwrites X-Real-IP with the peer address, so it can't be spoofed by the client. */
export function clientIp(request: Request): string {
  return (
    request.headers.get('x-real-ip')?.trim() ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

/** Per-IP cap on OTP sends, so one machine can't SMS many subscribers. */
export async function assertOtpIpLimit(request: Request): Promise<void> {
  const rl = await checkRateLimit(`otp:ip:${clientIp(request)}`, 10, 60 * 60)
  if (!rl.allowed) {
    throw new ApiError(429, 'Too many OTP requests from this device. Try again later.', 'RATE_LIMITED')
  }
}
