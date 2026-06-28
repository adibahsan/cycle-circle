import { describe, it, expect } from 'vitest'
import {
  otpCooldownRemaining,
  OTP_RESEND_COOLDOWN_SECONDS,
} from '@vesta/shared/server/services'

// FR-AUTH: server-side 60s OTP resend cooldown. The route rejects a resend
// while otpCooldownRemaining(...) > 0. These cover the pure decision logic.

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0) // fixed reference instant (ms)

describe('otpCooldownRemaining', () => {
  it('allows the first request (no prior challenge)', () => {
    expect(otpCooldownRemaining(null, NOW)).toBe(0)
  })

  it('returns the full window immediately after a request', () => {
    expect(otpCooldownRemaining(new Date(NOW), NOW)).toBe(OTP_RESEND_COOLDOWN_SECONDS)
  })

  it('counts down within the window', () => {
    const tenSecondsAgo = new Date(NOW - 10_000)
    expect(otpCooldownRemaining(tenSecondsAgo, NOW)).toBe(50)
  })

  it('allows again exactly at the boundary', () => {
    const sixtySecondsAgo = new Date(NOW - 60_000)
    expect(otpCooldownRemaining(sixtySecondsAgo, NOW)).toBe(0)
  })

  it('allows again past the window', () => {
    const longAgo = new Date(NOW - 61_000)
    expect(otpCooldownRemaining(longAgo, NOW)).toBe(0)
  })

  it('rounds up partial seconds (resend not offered a fraction early)', () => {
    const justUnder = new Date(NOW - 59_500) // 0.5s remaining
    expect(otpCooldownRemaining(justUnder, NOW)).toBe(1)
  })

  it('honours a custom cooldown window', () => {
    const fiveSecondsAgo = new Date(NOW - 5_000)
    expect(otpCooldownRemaining(fiveSecondsAgo, NOW, 30)).toBe(25)
  })
})
