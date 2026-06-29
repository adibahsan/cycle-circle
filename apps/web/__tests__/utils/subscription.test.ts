import { describe, it, expect } from 'vitest'
import { getSubscriptionTier, isPro } from '@vesta/shared/utils/subscription'

describe('getSubscriptionTier (Free = email-only; phone = Pro)', () => {
  it('returns PRO for an explicit PRO status (any auth method)', () => {
    expect(getSubscriptionTier({ authMethod: 'OTP', subscriptionStatus: 'PRO' })).toBe('PRO')
    expect(getSubscriptionTier({ authMethod: 'EMAIL', subscriptionStatus: 'PRO' })).toBe('PRO')
  })

  it('returns LAPSED for a lapsed user (never collapses to FREE)', () => {
    expect(getSubscriptionTier({ authMethod: 'OTP', subscriptionStatus: 'LAPSED' })).toBe('LAPSED')
    expect(getSubscriptionTier({ authMethod: 'EMAIL', subscriptionStatus: 'LAPSED' })).toBe('LAPSED')
  })

  it('treats a phone (OTP) user with a stale FREE row as PRO', () => {
    expect(getSubscriptionTier({ authMethod: 'OTP', subscriptionStatus: 'FREE' })).toBe('PRO')
    // missing status defaults to FREE → still PRO for a phone user
    expect(getSubscriptionTier({ authMethod: 'OTP' })).toBe('PRO')
  })

  it('returns FREE only for an email user that is FREE', () => {
    expect(getSubscriptionTier({ authMethod: 'EMAIL', subscriptionStatus: 'FREE' })).toBe('FREE')
  })

  it('is case-insensitive on subscriptionStatus', () => {
    expect(getSubscriptionTier({ authMethod: 'OTP', subscriptionStatus: 'pro' })).toBe('PRO')
    expect(getSubscriptionTier({ authMethod: 'EMAIL', subscriptionStatus: 'lapsed' })).toBe('LAPSED')
  })

  it('isPro reflects the tier', () => {
    expect(isPro({ authMethod: 'OTP', subscriptionStatus: 'FREE' })).toBe(true)
    expect(isPro({ authMethod: 'EMAIL', subscriptionStatus: 'FREE' })).toBe(false)
    expect(isPro({ authMethod: 'OTP', subscriptionStatus: 'LAPSED' })).toBe(false)
  })
})
