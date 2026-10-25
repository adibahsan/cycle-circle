import { describe, expect, it } from 'vitest'
import { emailErrorKey } from '../../src/lib/email-verify-errors'

describe('emailErrorKey', () => {
  it.each([
    ['INVALID_EMAIL', 'settings.invalidEmail'],
    ['EMAIL_TAKEN', 'settings.emailTaken'],
    ['OTP_COOLDOWN', 'trial.err.cooldown'],
    ['RATE_LIMITED', 'trial.err.rateLimited'],
    ['INVALID_OTP', 'trial.err.invalidCode'],
    ['CHALLENGE_EXPIRED', 'trial.err.invalidCode'],
    ['CHALLENGE_NOT_FOUND', 'trial.err.invalidCode'],
    ['OTP_LOCKED', 'trial.err.codeLocked'],
  ])('%s -> %s', (code, key) => {
    expect(emailErrorKey(code)).toBe(key)
  })

  it('falls back to the generic key for unknown, missing or prototype codes', () => {
    expect(emailErrorKey('NOPE')).toBe('trial.err.generic')
    expect(emailErrorKey(undefined)).toBe('trial.err.generic')
    expect(emailErrorKey('toString')).toBe('trial.err.generic')
  })
})
