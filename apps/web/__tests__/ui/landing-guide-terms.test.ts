import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import i18n from '@vesta/shared/utils/i18n'
import { COMPARISON_FEATURE_KEYS } from '@/lib/plan-features'

const src = path.resolve(__dirname, '../../src')
const read = (p: string) => readFileSync(path.join(src, p), 'utf8')

describe('landing guide, features and BDApps terms', () => {
  it('shares one Free/Pro list between /subscription and the landing page', () => {
    expect(read('app/(main)/subscription/SubscriptionClient.tsx')).toContain("from '@/lib/plan-features'")
    expect(read('app/(marketing)/welcome/sections/FeaturesSection.tsx')).toContain("from '@/lib/plan-features'")
    expect(COMPARISON_FEATURE_KEYS.some((f) => f.free)).toBe(true)
    expect(COMPARISON_FEATURE_KEYS.some((f) => !f.free)).toBe(true)
  })

  it('orders the landing sections', () => {
    const client = read('app/(marketing)/welcome/LandingClient.tsx')
    const order = ['<HeroSection', '<FeaturesSection', '<PhaseShowcaseSection', '<HowItWorksSection', '<SubscriptionChargesSection', '<SocialProofSection', '<CTASection', '<LandingFooter']
    const at = order.map((o) => client.indexOf(o))
    expect(at.every((i) => i >= 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('treats /guide as public and lists it in the sitemap', () => {
    expect(read('proxy.ts')).toMatch(/PUBLIC_PATHS = \[[^\]]*'\/guide'/)
    expect(read('app/sitemap.ts')).toContain('/guide')
  })

  it('anchors the Terms subscription section as #bdapps', () => {
    expect(read('app/(marketing)/terms/TermsClient.tsx')).toMatch(/key="subscription" id="bdapps"/)
  })

  it.each(['en', 'bn'] as const)('has no Grameenphone or billing-period claims in the Terms (%s)', (lng) => {
    const items = i18n.getResourceBundle(lng, 'translation').terms.sections.subscription.items as { desc: string }[]
    expect(items).toHaveLength(6)
    expect(JSON.stringify(items)).not.toMatch(/Grameenphone/)
  })
})
