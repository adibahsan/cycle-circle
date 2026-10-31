import { describe, it, expect } from 'vitest'
import { formatProPrice, proPriceVars } from '../pro-price-format'

describe('formatProPrice', () => {
  it('writes the English price with the period unit', () => {
    expect(formatProPrice({ amount: 5, period: 'DAILY' }, 'en')).toBe('৳5/day')
    expect(formatProPrice({ amount: 35, period: 'WEEKLY' }, 'en')).toBe('৳35/week')
    expect(formatProPrice({ amount: 99, period: 'MONTHLY' }, 'en')).toBe('৳99/month')
  })

  it('writes Bangla numerals and period words', () => {
    expect(formatProPrice({ amount: 5, period: 'DAILY' }, 'bn')).toBe('৳৫/দিন')
    expect(formatProPrice({ amount: 35, period: 'WEEKLY' }, 'bn')).toBe('৳৩৫/সপ্তাহ')
    expect(formatProPrice({ amount: 99, period: 'MONTHLY' }, 'bn')).toBe('৳৯৯/মাস')
  })

  it('keeps decimals', () => {
    expect(formatProPrice({ amount: 7.5, period: 'DAILY' }, 'en')).toBe('৳7.5/day')
    expect(formatProPrice({ amount: 7.5, period: 'DAILY' }, 'bn')).toBe('৳৭.৫/দিন')
    expect(formatProPrice({ amount: 12.25, period: 'WEEKLY' }, 'bn')).toBe('৳১২.২৫/সপ্তাহ')
  })

  it('treats any non-Bangla language as English', () => {
    expect(formatProPrice({ amount: 5, period: 'DAILY' }, 'en-US')).toBe('৳5/day')
  })
})

describe('proPriceVars', () => {
  it('gives the amount, period and whole price for text interpolation', () => {
    expect(proPriceVars({ amount: 5, period: 'DAILY' }, 'en')).toEqual({ price: '৳5/day', amount: '৳5', period: 'day' })
    expect(proPriceVars({ amount: 5, period: 'DAILY' }, 'bn')).toEqual({ price: '৳৫/দিন', amount: '৳৫', period: 'দিন' })
  })
})
