// ─── Redis adapter with in-memory fallback ───────────────────────────────────
//
// If REDIS_URL is set, a real ioredis client is created (singleton pattern for
// Next.js HMR).  Otherwise every function falls back to in-process Maps so the
// app starts without a Redis dependency (e.g. local dev, CI, test).
//
// When REDIS_URL is set but the server is unreachable the adapter degrades
// gracefully: every command catches the error, logs it (throttled to once per
// 30 s), and falls through to the in-memory path so the app keeps working.

import type { Redis as RedisType } from 'ioredis'
import { logger } from '../log'

// ─── Client singleton ─────────────────────────────────────────────────────────

type RedisGlobal = { redis: RedisType | null }
const globalForRedis = globalThis as unknown as RedisGlobal

let _redis: RedisType | null = null

// Throttle Redis error logging to avoid flooding the console during an outage.
let lastRedisErrorLoggedAt = 0
function logRedisError(context: string, err: unknown): void {
  const now = Date.now()
  if (now - lastRedisErrorLoggedAt > 30_000) {
    lastRedisErrorLoggedAt = now
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('redis.fallback', err, { context, message: `${context} failed; using in-memory fallback: ${msg}` })
  }
}

if (process.env.REDIS_URL) {
  if (globalForRedis.redis) {
    _redis = globalForRedis.redis
  } else {
    // Dynamic require so the module doesn't throw when ioredis is absent or
    // when REDIS_URL is not configured.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Redis = require('ioredis') as typeof import('ioredis').default
    _redis = new Redis(process.env.REDIS_URL, {
      // Fail fast instead of blocking the request path when Redis is down.
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 1000,
      // Bounded backoff so a dead server doesn't retry-storm.
      retryStrategy: (times: number) => Math.min(times * 200, 2000),
    })
    // Without an error handler ioredis emits unhandled AggregateError events
    // when the server is unreachable. Swallow + throttle-log instead.
    _redis.on('error', (err: unknown) => logRedisError('connection', err))
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
    } catch (err) {
      logRedisError('blacklistJti', err)
      // Fall through to in-memory path (best-effort)
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
    } catch (err) {
      logRedisError('isJtiBlacklisted', err)
      // Fall through to in-memory lookup (fail-open — a Redis outage must NOT
      // reject valid tokens or log users out).
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

// ─── Sessions-valid-after marker ──────────────────────────────────────────────
//
// Per-user epoch-ms marker: JWTs issued at or before it are rejected. The
// database column User.sessionsValidAfter is the source of truth; this is the
// cheap read path. Value "0" means "no marker" (negative cache).

const SESSIONS_VALID_AFTER_TTL_SECONDS = 60 * 60 * 24 * 31 // outlives the 30-day JWT

/** Returns the cached marker (epoch ms, 0 = none), or null on cache miss / no Redis / outage. */
export async function getSessionsValidAfterCache(userId: string): Promise<number | null> {
  if (!redis) return null
  try {
    const v = await redis.get(`sva:${userId}`)
    return v === null ? null : Number(v)
  } catch (err) {
    logRedisError('getSessionsValidAfterCache', err)
    return null
  }
}

/** Writes the marker (epoch ms, 0 = none) to the cache. Best-effort. */
export async function setSessionsValidAfterCache(userId: string, ms: number): Promise<void> {
  if (!redis) return
  try {
    await redis.set(`sva:${userId}`, String(ms), 'EX', SESSIONS_VALID_AFTER_TTL_SECONDS)
  } catch (err) {
    logRedisError('setSessionsValidAfterCache', err)
  }
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
    } catch (err) {
      logRedisError('checkRateLimit', err)
      // Fall through to in-memory sliding-window block
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

/**
 * Counts hits in the window WITHOUT recording one. Pair with `recordRateLimitHit`
 * to rate-limit only the events you choose to count (e.g. failed logins).
 * `allowed` is false once `limit` hits are already recorded.
 */
export async function peekRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const windowStart = Date.now() - windowSeconds * 1000

  if (redis) {
    try {
      const multi = redis.multi()
      multi.zremrangebyscore(key, 0, windowStart)
      multi.zcard(key)
      const results = await multi.exec()
      const count = (results?.[1]?.[1] as number) ?? 0
      return { allowed: count < limit, remaining: Math.max(0, limit - count) }
    } catch (err) {
      logRedisError('peekRateLimit', err)
    }
  }

  const count = (memRateLimit.get(key) ?? []).filter((ts) => ts > windowStart).length
  return { allowed: count < limit, remaining: Math.max(0, limit - count) }
}

/** Records one hit against `key` in the sliding window. */
export async function recordRateLimitHit(key: string, windowSeconds: number): Promise<void> {
  const now = Date.now()
  const windowStart = now - windowSeconds * 1000

  if (redis) {
    try {
      const multi = redis.multi()
      multi.zremrangebyscore(key, 0, windowStart)
      multi.zadd(key, now, `${now}-${Math.random()}`)
      multi.expire(key, windowSeconds)
      await multi.exec()
      return
    } catch (err) {
      logRedisError('recordRateLimitHit', err)
    }
  }

  const timestamps = (memRateLimit.get(key) ?? []).filter((ts) => ts > windowStart)
  timestamps.push(now)
  memRateLimit.set(key, timestamps)
}
