import { describe, it, expect, beforeAll } from 'vitest'

// REDIS_URL must be unset before the adapter loads so the in-memory path is used.
delete process.env.REDIS_URL
const { peekRateLimit, recordRateLimitHit } = await import('@vesta/shared/server/adapters/redis')

describe('peekRateLimit / recordRateLimitHit (in-memory)', () => {
  beforeAll(() => {
    expect(process.env.REDIS_URL).toBeUndefined()
  })

  it('peeking does not record a hit', async () => {
    for (let i = 0; i < 10; i++) await peekRateLimit('t:peek-only', 3, 60)
    const r = await peekRateLimit('t:peek-only', 3, 60)
    expect(r).toEqual({ allowed: true, remaining: 3 })
  })

  it('blocks once the limit of recorded hits is reached', async () => {
    const key = 't:limit'
    for (let i = 0; i < 2; i++) await recordRateLimitHit(key, 60)
    expect(await peekRateLimit(key, 3, 60)).toEqual({ allowed: true, remaining: 1 })
    await recordRateLimitHit(key, 60)
    expect(await peekRateLimit(key, 3, 60)).toEqual({ allowed: false, remaining: 0 })
  })

  it('keys are independent', async () => {
    await recordRateLimitHit('t:a', 60)
    expect((await peekRateLimit('t:b', 1, 60)).allowed).toBe(true)
  })

  it('hits older than the window stop counting', async () => {
    const key = 't:window'
    await recordRateLimitHit(key, 1)
    expect((await peekRateLimit(key, 1, 1)).allowed).toBe(false)
    await new Promise((r) => setTimeout(r, 1100))
    expect((await peekRateLimit(key, 1, 1)).allowed).toBe(true)
  })
})
