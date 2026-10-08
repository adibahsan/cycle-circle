import { describe, it, expect, beforeAll } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  EMAIL_PALETTE,
  periodAlertEmail,
  fertileWindowEmail,
  loggingReminderEmail,
  profileCompletionReminderEmail,
} from '@vesta/shared/server/email-templates'
import { buildMagicLinkEmailHtml } from '@vesta/shared/server/magic-link-email'

const OUT_DIR = '/tmp/implement-orchestrated/cycle-circle-rebrand/emails'
const base = { userName: 'Amina', profileName: 'Amina' }

const LEGACY_HEX = ['E8476C', '9B7FD4', 'FFF5F7', 'F8F4FF', '2D1A24', '6B4458', '8C5E74', '4A3568', 'B0849A', 'F3E8EC', 'E87B9E', 'F9F5F1']

const renders: Record<string, string> = {}
const build = () => {
  for (const [code, l] of [['en', 'EN'], ['bn', 'BN']] as const) {
    renders[`period-alert-${code}`] = periodAlertEmail({ ...base, language: l, predictedDate: '12 Oct', daysUntil: 2 }).html
    renders[`fertile-window-${code}`] = fertileWindowEmail({ ...base, language: l, fertileStart: '1 Oct', fertileEnd: '6 Oct', ovulationDate: '6 Oct' }).html
    renders[`logging-reminder-${code}`] = loggingReminderEmail({ ...base, language: l, daysSinceLastLog: 3 }).html
    renders[`profile-completion-${code}`] = profileCompletionReminderEmail({ userName: 'Amina', language: l }).html
    renders[`magic-link-${code}`] = buildMagicLinkEmailHtml('https://example.test/api/auth/magic-link/callback?token=abc', code).html
  }
}

beforeAll(() => {
  process.env.APP_URL = 'https://app.example.test/'
  build()
  mkdirSync(OUT_DIR, { recursive: true })
  for (const [name, html] of Object.entries(renders)) writeFileSync(resolve(OUT_DIR, `${name}.html`), html)
})

describe('email brand: every template', () => {
  it('renders all templates', () => {
    expect(Object.keys(renders)).toHaveLength(10)
  })

  it('has no legacy palette hex and no Vesta', () => {
    for (const [name, html] of Object.entries(renders)) {
      for (const hex of LEGACY_HEX) expect(html.toUpperCase(), `${name} ${hex}`).not.toContain(`#${hex}`)
      expect(html, name).not.toMatch(/Vesta|ভেস্তা|vesta\.health/i)
    }
  })

  it('has the absolute logo img with alt and width', () => {
    for (const [name, html] of Object.entries(renders)) {
      expect(html, name).toContain('src="https://app.example.test/brand/cycle-circle-logo.png"')
      expect(html, name).toMatch(/<img[^>]*alt="Cycle Circle"[^>]*>/)
      expect(html, name).toMatch(/<img[^>]*width="160"/)
    }
  })

  it('has the footer mailto contact', () => {
    for (const [name, html] of Object.entries(renders)) {
      expect(html, name).toContain('href="mailto:info@cycle-circle.com"')
    }
  })

  it('uses the page background and ink colours', () => {
    for (const [name, html] of Object.entries(renders)) {
      expect(html, name).toContain(`background:${EMAIL_PALETTE.bg}`)
      expect(html, name).toContain(EMAIL_PALETTE.ink)
      expect(html, name).toContain(EMAIL_PALETTE.muted)
    }
  })
})

describe('email brand: CTA buttons', () => {
  const ctaNames = ['profile-completion-en', 'profile-completion-bn', 'magic-link-en', 'magic-link-bn']
  it('are pills, #D02F58 with white text', () => {
    for (const name of ctaNames) {
      const html = renders[name]
      const a = html.match(/<a [^>]*display:inline-block[^>]*>/)?.[0] ?? ''
      expect(a, name).toContain('background:#D02F58')
      expect(a, name).toMatch(/color:#FFFFFF/)
      expect(a, name).toContain('border-radius:999px')
    }
  })
  it('profile completion CTA links under APP_URL', () => {
    expect(renders['profile-completion-en']).toContain('href="https://app.example.test/profiles"')
  })
})
