import { describe, it, expect } from 'vitest'
import { getTrialStatus, isTrialExpired, getTrialHoursLeft } from '@vesta/shared/utils/trial'

const HOUR = 60 * 60 * 1000

describe('trial helper (getTrialStatus / isTrialExpired)', () => {
  it('reports an expired trial for an EMAIL + FREE user past their window', () => {
    const u = {
      authMethod: 'EMAIL',
      subscriptionStatus: 'FREE',
      emailTrialExpiresAt: new Date(Date.now() - 24 * HOUR),
    }
    expect(getTrialStatus(u)).toBe('expired')
    expect(isTrialExpired(u)).toBe(true)
  })

  it('reports an active trial for an EMAIL + FREE user within their window', () => {
    const u = {
      authMethod: 'EMAIL',
      subscriptionStatus: 'FREE',
      emailTrialExpiresAt: new Date(Date.now() + 11 * HOUR + 30 * 60 * 1000),
    }
    expect(getTrialStatus(u)).toBe('active')
    expect(isTrialExpired(u)).toBe(false)
    expect(getTrialHoursLeft(u.emailTrialExpiresAt)).toBe(11) // floor of ~11.5h
  })

  it('uses uppercase DB enum values (not lowercase)', () => {
    // Guards against the original casing bug where 'email'/'free' were compared.
    expect(getTrialStatus({ authMethod: 'email', subscriptionStatus: 'free', emailTrialExpiresAt: new Date(Date.now() - HOUR) })).toBe('none')
    expect(getTrialStatus({ authMethod: 'EMAIL', subscriptionStatus: 'FREE', emailTrialExpiresAt: new Date(Date.now() - HOUR) })).toBe('expired')
  })

  it('returns none for OTP users regardless of trial date', () => {
    expect(getTrialStatus({ authMethod: 'OTP', subscriptionStatus: 'FREE', emailTrialExpiresAt: new Date(Date.now() - HOUR) })).toBe('none')
    expect(isTrialExpired({ authMethod: 'OTP', subscriptionStatus: 'FREE', emailTrialExpiresAt: null })).toBe(false)
  })

  it('returns none for PRO users (paid — no trial gating)', () => {
    expect(getTrialStatus({ authMethod: 'EMAIL', subscriptionStatus: 'PRO', emailTrialExpiresAt: new Date(Date.now() - HOUR) })).toBe('none')
  })

  it('returns none when emailTrialExpiresAt is missing', () => {
    expect(getTrialStatus({ authMethod: 'EMAIL', subscriptionStatus: 'FREE', emailTrialExpiresAt: null })).toBe('none')
    expect(getTrialHoursLeft(null)).toBeNull()
  })
})
