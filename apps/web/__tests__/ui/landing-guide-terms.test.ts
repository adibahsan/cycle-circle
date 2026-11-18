import { readFileSync } from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { proxy } from '@/proxy'
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

  it('claims Pro-only only for what the app gates by plan (SMS alerts)', () => {
    expect(COMPARISON_FEATURE_KEYS.filter((f) => !f.free).map((f) => f.key)).toEqual(['smsAlerts'])
    expect(COMPARISON_FEATURE_KEYS.map((f) => f.key)).not.toContain('adFree')
  })

  it('final CTA does not promise a free start without naming the trial', () => {
    for (const lng of ['en', 'bn']) {
      const s = i18n.getFixedT(lng)('landing.finalCtaSubtitle')
      expect(s).not.toMatch(/No card required|কার্ডের প্রয়োজন নেই/)
      expect(s).toMatch(/24|২৪/)
    }
  })

  it('orders the landing sections', () => {
    const client = read('app/(marketing)/welcome/LandingClient.tsx')
    const order = ['<HeroSection', '<FeaturesSection', '<PhaseShowcaseSection', '<HowItWorksSection', '<SubscriptionChargesSection', '<SocialProofSection', '<CTASection', '<LandingFooter']
    const at = order.map((o) => client.indexOf(o))
    expect(at.every((i) => i >= 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it.each(['/guide', '/terms', '/privacy'])('serves %s to signed-out visitors without a redirect', async (route) => {
    const res = await proxy(new NextRequest(`http://localhost${route}`))
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  it('lists /guide in the sitemap', () => {
    expect(read('app/sitemap.ts')).toContain('/guide')
  })

  it('anchors the Terms subscription section as #bdapps', () => {
    expect(read('app/(marketing)/terms/TermsClient.tsx')).toMatch(/key="subscription" id="bdapps"/)
  })

  it.each(['en', 'bn'] as const)('Terms subscription copy is the BDApps copy, not the old claims (%s)', (lng) => {
    const sub = i18n.getResourceBundle(lng, 'translation').terms.sections.subscription
    const items = (sub.items as { desc: string }[]).map((i) => i.desc)
    const all = JSON.stringify(sub)
    expect(all).not.toMatch(/Grameenphone|end of the current billing period|access continues|বর্তমান বিলিং পিরিয়ড শেষ|অ্যাক্সেস অব্যাহত/)
    const immediate = lng === 'en' ? /free plan immediately/ : /সঙ্গে সঙ্গে ফ্রি প্ল্যানে/
    expect(items.some((d) => immediate.test(d))).toBe(true)
  })
})
