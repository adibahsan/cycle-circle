import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import i18n from '@vesta/shared/utils/i18n'
import {
  periodAlertEmail,
  fertileWindowEmail,
  loggingReminderEmail,
  profileCompletionReminderEmail,
} from '@vesta/shared/server/email-templates'
import { buildMagicLinkEmailHtml } from '@vesta/shared/server/magic-link-email'

const BANNED = [/Vesta/, /ভেস্তা/, /CycleCircle/, /cycle circle/]

function walk(node: unknown, path: string, out: Array<[string, string]>) {
  if (typeof node === 'string') out.push([path, node])
  else if (Array.isArray(node)) node.forEach((v, i) => walk(v, `${path}[${i}]`, out))
  else if (node && typeof node === 'object')
    for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k, out)
}

function bundle(lng: 'en' | 'bn') {
  const out: Array<[string, string]> = []
  walk(i18n.getResourceBundle(lng, 'translation'), '', out)
  return out
}

describe.each(['en', 'bn'] as const)('i18n %s brand copy', (lng) => {
  it('has values and none contain a banned brand spelling', () => {
    const entries = bundle(lng)
    expect(entries.length).toBeGreaterThan(100)
    const bad = entries.filter(([, v]) => BANNED.some((re) => re.test(v))).map(([k]) => k)
    expect(bad).toEqual([])
  })

  it('has no stale support@vesta.health', () => {
    expect(bundle(lng).filter(([, v]) => v.includes('vesta.health'))).toEqual([])
  })
})

describe('brand name', () => {
  it('EN and BN app names', () => {
    expect(i18n.t('app.name', { lng: 'en' })).toBe('Cycle Circle')
    expect(i18n.t('app.name', { lng: 'bn' })).toBe('সাইকেল সার্কেল')
  })
  it('BN inflects naturally', () => {
    expect(i18n.t('onboarding.welcome', { lng: 'bn' })).toContain('সাইকেল সার্কেলে')
  })
})

describe('contact block', () => {
  const phone = '+880 18102 04718'
  const address = 'AWR U Tower, Plot 35, Road 133, Gulshan 1, Dhaka 1212'
  it.each(['en', 'bn'] as const)('%s keys', (lng) => {
    expect(i18n.t('contactInfo.email', { lng })).toBe('info@cycle-circle.com')
    expect(i18n.t('contactInfo.phone', { lng })).toBe(phone)
    expect(i18n.t('contactInfo.address', { lng })).toBe(address)
    for (const k of ['heading', 'emailLabel', 'phoneLabel', 'addressLabel']) {
      const v = i18n.t(`contactInfo.${k}`, { lng })
      expect(v).not.toBe(`contactInfo.${k}`)
      expect(v.length).toBeGreaterThan(0)
    }
  })
})

describe('email subjects and bodies', () => {
  const base = { userName: 'A', profileName: 'B' }
  it('EN subjects start with "Cycle Circle"', () => {
    const l = 'EN' as const
    const subjects = [
      periodAlertEmail({ ...base, language: l, predictedDate: 'x', daysUntil: 2 }).subject,
      fertileWindowEmail({ ...base, language: l, fertileStart: 'a', fertileEnd: 'b', ovulationDate: 'c' }).subject,
      loggingReminderEmail({ ...base, language: l, daysSinceLastLog: 3 }).subject,
      profileCompletionReminderEmail({ userName: 'A', language: l }).subject,
      buildMagicLinkEmailHtml('https://x', 'en').subject,
    ]
    subjects.forEach((s) => expect(s).toMatch(/^Cycle Circle\b/))
  })
  it('BN subjects start with "সাইকেল সার্কেল" and nothing mentions Vesta', () => {
    const l = 'BN' as const
    const results = [
      periodAlertEmail({ ...base, language: l, predictedDate: 'x', daysUntil: 2 }),
      fertileWindowEmail({ ...base, language: l, fertileStart: 'a', fertileEnd: 'b', ovulationDate: 'c' }),
      loggingReminderEmail({ ...base, language: l, daysSinceLastLog: 3 }),
      profileCompletionReminderEmail({ userName: 'A', language: l }),
      buildMagicLinkEmailHtml('https://x', 'bn'),
    ]
    results.forEach((r) => expect(r.subject).toMatch(/^সাইকেল সার্কেল/))
    for (const lang of ['EN', 'BN'] as const) {
      const r = periodAlertEmail({ ...base, language: lang, predictedDate: 'x', daysUntil: 2 })
      expect(r.html).not.toMatch(/Vesta|ভেস্তা/)
      expect(r.html).toContain(lang === 'EN' ? 'Cycle Circle' : 'সাইকেল সার্কেল')
    }
  })
})

describe('SMS prefixes', () => {
  const src = readFileSync(
    resolve(__dirname, '../../../../packages/shared/src/server/adapters/notifications.ts'),
    'utf8',
  )
  it('use the new brand prefix only', () => {
    expect(src).not.toMatch(/Vesta|ভেস্তা/)
    expect((src.match(/`Cycle Circle: /g) ?? []).length).toBe(4)
    expect((src.match(/`সাইকেল সার্কেল: /g) ?? []).length).toBe(4)
  })
})
