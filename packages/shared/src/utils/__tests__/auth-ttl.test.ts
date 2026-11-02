import { describe, it, expect } from 'vitest'
import { MAGIC_LINK_TTL_MS, OTP_TTL_MS, durationText } from '../auth-ttl'

describe('auth TTLs', () => {
  it('an OTP lives 5 minutes and a magic link 1 hour', () => {
    expect(OTP_TTL_MS).toBe(300_000)
    expect(MAGIC_LINK_TTL_MS).toBe(3_600_000)
  })
})

describe('durationText', () => {
  it('writes minutes under an hour', () => {
    expect(durationText(300_000, 'en')).toBe('5 minutes')
    expect(durationText(60_000, 'en')).toBe('1 minute')
    expect(durationText(300_000, 'bn')).toBe('৫ মিনিট')
  })

  it('writes whole hours as hours', () => {
    expect(durationText(3_600_000, 'en')).toBe('1 hour')
    expect(durationText(7_200_000, 'en')).toBe('2 hours')
    expect(durationText(3_600_000, 'bn')).toBe('১ ঘণ্টা')
  })
})
