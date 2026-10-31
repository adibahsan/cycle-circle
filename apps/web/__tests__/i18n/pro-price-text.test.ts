import { describe, it, expect } from 'vitest'
import i18n from '@vesta/shared/utils/i18n'
import { proPriceVars } from '@vesta/shared/utils/pro-price-format'

const price = { amount: 7.5, period: 'WEEKLY' as const }

function flatten(value: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) flatten(v, prefix ? `${prefix}.${k}` : k, out)
  } else if (typeof value === 'string') {
    out[prefix] = value
  }
  return out
}

describe.each(['en', 'bn'] as const)('Pro price text (%s)', (lng) => {
  const bundle = flatten(i18n.getResourceBundle(lng, 'translation'))
  const t = i18n.getFixedT(lng)

  it('has no hard-coded taka price in any text', () => {
    const offenders = Object.entries(bundle).filter(([, v]) => /৳\s*[\d০-৯]/.test(v)).map(([k]) => k)
    expect(offenders).toEqual([])
  })

  it('does not name CAAS or the aggregation service', () => {
    const offenders = Object.entries(bundle)
      .filter(([k, v]) => k.startsWith('terms.') && /CAAS|Aggregation|অ্যাগ্রিগেশন/i.test(v))
      .map(([k]) => k)
    expect(offenders).toEqual([])
  })

  it('states the price in the Terms', () => {
    const vars = proPriceVars(price, lng)
    expect(t('terms.sections.subscription.intro', vars)).toContain(vars.price)
  })

  it('states amount and period in the upgrade confirmation', () => {
    const vars = proPriceVars(price, lng)
    const text = t('subscription.confirmDeduction', vars)
    expect(text).toContain(vars.amount)
    expect(text).toContain(vars.period)
  })
})
