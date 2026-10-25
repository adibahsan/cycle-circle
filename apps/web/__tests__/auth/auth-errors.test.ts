import { describe, it, expect } from 'vitest'
import { authErrorMessage } from '@/lib/auth-errors'

const t = (key: string) => `t:${key}`

describe('authErrorMessage', () => {
  it('maps OPERATOR_NOT_SUPPORTED to its own key', () => {
    const body = { error: { code: 'OPERATOR_NOT_SUPPORTED', message: 'BDApps error: E1301 (...)' } }
    expect(authErrorMessage(body, 'auth.sendOtpFailed', t)).toBe('t:auth.operatorNotSupported')
  })

  it('never leaks a raw server message for unknown codes', () => {
    const body = { error: { code: 'BDAPPS_E9999', message: 'BDApps error: E9999 (secret gateway text)' } }
    expect(authErrorMessage(body, 'auth.sendOtpFailed', t)).toBe('t:auth.sendOtpFailed')
  })

  it('uses the fallback for a code-less object error', () => {
    expect(authErrorMessage({ error: { message: 'raw' } }, 'auth.sendOtpFailed', t)).toBe('t:auth.sendOtpFailed')
  })

  it('uses the fallback for string errors and empty bodies', () => {
    expect(authErrorMessage({ error: 'raw string' }, 'auth.sendOtpFailed', t)).toBe('t:auth.sendOtpFailed')
    expect(authErrorMessage({}, 'auth.resendFailed', t)).toBe('t:auth.resendFailed')
  })

  it('maps ALREADY_SUBSCRIBED by hasEmail', () => {
    expect(authErrorMessage({ error: { code: 'ALREADY_SUBSCRIBED', hasEmail: true } }, 'x', t)).toBe('t:auth.alreadySubscribedEmail')
    expect(authErrorMessage({ error: { code: 'ALREADY_SUBSCRIBED', hasEmail: false } }, 'x', t)).toBe('t:auth.alreadySubscribedNoEmail')
    expect(authErrorMessage({ error: { code: 'ALREADY_SUBSCRIBED' } }, 'x', t)).toBe('t:auth.alreadySubscribedNoEmail')
  })

  it.each([
    ['INVALID_PHONE', 'auth.phoneInvalid'],
    ['INVALID_OTP', 'trial.err.invalidCode'],
    ['CHALLENGE_EXPIRED', 'trial.err.invalidCode'],
    ['CHALLENGE_NOT_FOUND', 'trial.err.invalidCode'],
    ['ALREADY_VERIFIED', 'trial.err.invalidCode'],
    ['RATE_LIMITED', 'trial.err.rateLimited'],
    ['OTP_COOLDOWN', 'trial.err.cooldown'],
    ['OTP_LOCKED', 'trial.err.codeLocked'],
  ])('maps %s to %s', (code, key) => {
    expect(authErrorMessage({ error: { code, message: 'raw' } }, 'fallback', t)).toBe(`t:${key}`)
  })
})
