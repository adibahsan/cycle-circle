// ─── Redis adapter with in-memory fallback ───────────────────────────────────
//
// If REDIS_URL is set, a real ioredis client is created (singleton pattern for
// Next.js HMR).  Otherwise every function falls back to in-process Maps so the
// app starts without a Redis dependency (e.g. local dev, CI, test).

import type { Redis as RedisType } from 'ioredis'

// ─── Client singleton ─────────────────────────────────────────────────────────

type RedisGlobal = { redis: RedisType | null }
const globalForRedis = globalThis as unknown as RedisGlobal

let _redis: RedisType | null = null
let loggedRedisConnectionError = false

if (process.env.REDIS_URL) {
  if (globalForRedis.redis) {
    _redis = globalForRedis.redis
  } else {
    // Dynamic require so the module doesn't throw when ioredis is absent or
    // when REDIS_URL is not configured.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Redis = require('ioredis') as typeof import('ioredis').default
    _redis = new Redis(process.env.REDIS_URL, {
      // Fail fast when Redis is down so callers can fallback to memory.
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    })
    _redis.on('error', (error: unknown) => {
      if (!loggedRedisConnectionError) {
        loggedRedisConnectionError = true
        console.warn(
          '[redis] connection unavailable; using in-memory fallback',
          error instanceof Error ? error.message : error,
        )
      }
    })
    if (process.env.NODE_ENV !== 'production') globalForRedis.redis = _redis
  }
}

/** The ioredis client, or `null` when running without Redis. */
export const redis: RedisType | null = _redis

// ─── In-memory stores (used when redis === null) ──────────────────────────────

/** blacklist:jti → expiry timestamp (ms) */
const memBlacklist = new Map<string, number>()

/** rate-limit key → array of request timestamps (ms) */
const memRateLimit = new Map<string, number[]>()

// ─── JWT Blacklist ────────────────────────────────────────────────────────────

/**
 * Add a JTI to the blacklist with an absolute TTL matching the token expiry.
 */
export async function blacklistJti(
  jti: string,
  expiresInSeconds: number,
): Promise<void> {
  if (redis) {
    try {
      await redis.set(`blacklist:${jti}`, '1', 'EX', expiresInSeconds)
      return
    } catch {
      // Fall through to in-memory fallback when Redis is unavailable.
    }
  }
  memBlacklist.set(`blacklist:${jti}`, Date.now() + expiresInSeconds * 1000)
}

/**
 * Returns true if the JTI has been blacklisted (i.e. the token was revoked).
 */
export async function isJtiBlacklisted(jti: string): Promise<boolean> {
  if (redis) {
    try {
      return (await redis.exists(`blacklist:${jti}`)) === 1
    } catch {
      // Fall through to in-memory fallback when Redis is unavailable.
    }
  }
  const key = `blacklist:${jti}`
  const expiry = memBlacklist.get(key)
  if (expiry === undefined) return false
  if (Date.now() > expiry) {
    memBlacklist.delete(key)
    return false
  }
  return true
}

// ─── Sliding-window Rate Limiter ──────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean
  remaining: number
}

/**
 * Sliding-window rate limiter.
 *
 * When Redis is available it uses a sorted-set pipeline.  When absent it uses
 * an in-process timestamp array (suitable for single-process dev/test).
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

  if (redis) {
    try {
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
    } catch {
      // Fall through to in-memory fallback when Redis is unavailable.
    }
  }

  // In-memory path
  const timestamps = (memRateLimit.get(key) ?? []).filter(
    (ts) => ts > windowStart,
  )
  timestamps.push(now)
  memRateLimit.set(key, timestamps)
  const count = timestamps.length

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
  }
}
