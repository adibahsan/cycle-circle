import Redis from 'ioredis'
import { env } from '@/lib/env'

const globalForRedis = globalThis as unknown as { redis: Redis }

export const redis = globalForRedis.redis ?? new Redis(env.REDIS_URL)

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis

// ─── JWT Blacklist ────────────────────────────────────────────────────────────

/**
 * Add a JTI to the blacklist with an absolute TTL matching the token expiry.
 */
export async function blacklistJti(
  jti: string,
  expiresInSeconds: number,
): Promise<void> {
  await redis.set(`blacklist:${jti}`, '1', 'EX', expiresInSeconds)
}

/**
 * Returns true if the JTI has been blacklisted (i.e. the token was revoked).
 */
export async function isJtiBlacklisted(jti: string): Promise<boolean> {
  return (await redis.exists(`blacklist:${jti}`)) === 1
}

// ─── Sliding-window Rate Limiter ──────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean
  remaining: number
}

/**
 * Sliding-window rate limiter backed by a Redis sorted set.
 *
 * @param key           Unique identifier for the resource being rate-limited.
 * @param limit         Maximum number of requests allowed within the window.
 * @param windowSeconds Window size in seconds.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = Date.now()
  const windowStart = now - windowSeconds * 1000

  const multi = redis.multi()
  // Remove entries older than the window
  multi.zremrangebyscore(key, 0, windowStart)
  // Record current request with score = timestamp, member = unique timestamp
  multi.zadd(key, now, `${now}-${Math.random()}`)
  // Count entries in the current window
  multi.zcard(key)
  // Reset the TTL so the key expires after the window
  multi.expire(key, windowSeconds)

  const results = await multi.exec()
  const count = (results?.[2]?.[1] as number) ?? 0

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
  }
}
