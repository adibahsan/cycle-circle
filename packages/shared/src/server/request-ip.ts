/**
 * The client IP behind our reverse proxy. Prefer x-real-ip (our nginx overwrites it with
 * the peer address); fall back to the first x-forwarded-for entry. Undefined when neither is set.
 */
export function requestIp(request: Request): string | undefined {
  const realIp = request.headers.get('x-real-ip')?.trim()
  const forwarded = request.headers.get('x-forwarded-for')
  return realIp || forwarded?.split(',')[0]?.trim() || undefined
}
