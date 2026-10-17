import { describe, it, expect } from 'vitest'
import { toLocalPhone } from '@/lib/phone'

describe('toLocalPhone: stored/international forms → the 11-digit 01… form the phone field shows', () => {
  it('converts +8801…, 8801… and tel:8801…', () => {
    expect(toLocalPhone('+8801805718862')).toBe('01805718862')
    expect(toLocalPhone('8801805718862')).toBe('01805718862')
    expect(toLocalPhone('tel:8801805718862')).toBe('01805718862')
  })
  it('keeps a local number and strips formatting', () => {
    expect(toLocalPhone('01805718862')).toBe('01805718862')
    expect(toLocalPhone('018-0571 8862')).toBe('01805718862')
  })
  it('returns empty for nothing', () => {
    expect(toLocalPhone(null)).toBe('')
    expect(toLocalPhone(undefined)).toBe('')
  })
})
