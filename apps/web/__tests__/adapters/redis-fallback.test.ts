/**
 * Redis adapter fallback tests.
 *
 * Test A: in-memory path (REDIS_URL unset, the default in test env).
 * Test B: outage fallback (REDIS_URL set but ioredis client always rejects).
 */

import {
  blacklistJti,
  isJtiBlacklisted,
  checkRateLimit,
} from '@vesta/shared/server/adapters/redis'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Test A: in-memory path ───────────────────────────────────────────────────

describe('Redis adapter — in-memory path (REDIS_URL unset)', () => {
  // Use a counter to keep keys unique across assertions so state doesn't leak.
  let seq = 0
  function uid(): string {
    return `test-${Date.now()}-${++seq}`
  }

  it('a freshly generated jti is not blacklisted', async () => {
    const jti = uid()
    expect(await isJtiBlacklisted(jti)).toBe(false)
  })

  it('after blacklistJti the jti IS blacklisted', async () => {
    const jti = uid()
    await blacklistJti(jti, 60)
    expect(await isJtiBlacklisted(jti)).toBe(true)
  })

  it('blacklistJti with negative TTL (already expired) → isJtiBlacklisted returns false', async () => {
    const jti = uid()
    await blacklistJti(jti, -1)
    expect(await isJtiBlacklisted(jti)).toBe(false)
  })

  it('checkRateLimit allows first N=2 calls then blocks the 3rd', async () => {
    const key = `test:key:${uid()}`
    const result1 = await checkRateLimit(key, 2, 60)
    const result2 = await checkRateLimit(key, 2, 60)
    const result3 = await checkRateLimit(key, 2, 60)

    expect(result1.allowed).toBe(true)
    expect(result2.allowed).toBe(true)
    expect(result3.allowed).toBe(false)
  })
})

// ─── Test B: outage fallback ──────────────────────────────────────────────────

describe('Redis adapter — outage fallback (REDIS_URL set but client rejects)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  afterAll(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('degrades gracefully when the ioredis client always rejects', async () => {
    vi.resetModules()
    vi.stubEnv('REDIS_URL', 'redis://127.0.0.1:6399')

    vi.doMock('ioredis', () => ({
      default: class FakeRedis {
        constructor() {}
        on() {}
        set() {
          return Promise.reject(new Error('ECONNREFUSED'))
        }
        exists() {
          return Promise.reject(new Error('ECONNREFUSED'))
        }
        multi() {
          return {
            zremrangebyscore() {
              return this
            },
            zadd() {
              return this
            },
            zcard() {
              return this
            },
            expire() {
              return this
            },
            exec() {
              return Promise.reject(new Error('ECONNREFUSED'))
            },
          }
        }
      },
    }))

    const redisMod = await import('@vesta/shared/server/adapters/redis')

    // isJtiBlacklisted must resolve to false (fail-open) — not throw.
    await expect(redisMod.isJtiBlacklisted('nope')).resolves.toBe(false)

    // blacklistJti must not throw even though Redis rejects.
    await expect(redisMod.blacklistJti('x', 60)).resolves.toBeUndefined()

    // checkRateLimit must resolve with allowed === true (in-memory fallback).
    const result = await redisMod.checkRateLimit('k', 5, 60)
    expect(result.allowed).toBe(true)
  })
})
