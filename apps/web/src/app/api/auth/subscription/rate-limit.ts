type RateLimitResult = {
  allowed: boolean
  remaining: number
}

type RateLimitStore = Map<string, number[]>

declare global {
  // eslint-disable-next-line no-var
  var __vestaSubscriptionRateLimitStore: RateLimitStore | undefined
}

const store: RateLimitStore =
  globalThis.__vestaSubscriptionRateLimitStore ?? new Map()

if (!globalThis.__vestaSubscriptionRateLimitStore) {
  globalThis.__vestaSubscriptionRateLimitStore = store
}

export function checkSubscriptionRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  const now = Date.now()
  const windowStart = now - windowSeconds * 1000

  const timestamps = (store.get(key) ?? []).filter((ts) => ts > windowStart)
  timestamps.push(now)
  store.set(key, timestamps)

  const count = timestamps.length
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
  }
}
