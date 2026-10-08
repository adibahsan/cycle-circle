import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '../../../..')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')

function block(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`block not found: ${selector}`)
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('\n}', start))
  const out: Record<string, string> = {}
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}
function luminance(h: string): number {
  const n = parseInt(h.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const css = read('apps/admin/src/app/globals.css')
const light = block(css, '@theme')
const dark = { ...light, ...block(css, '.dark') }
const STATUSES = ['success', 'warning', 'danger', 'info'] as const
const SURFACES = ['--color-bg-primary', '--color-bg-secondary', '--color-bg-card']

describe('admin status tokens', () => {
  for (const [name, tokens] of [['light', light], ['dark', dark]] as const) {
    for (const s of STATUSES) {
      it(`${name}: ${s} text reaches 4.5:1 on its tint and on every surface`, () => {
        const fg = tokens[`--color-${s}`]
        expect(fg, `--color-${s}`).toBeDefined()
        expect(contrast(fg, tokens[`--color-${s}-bg`]), 'on tint').toBeGreaterThanOrEqual(4.5)
        for (const surf of SURFACES)
          expect(contrast(fg, tokens[surf]), `on ${surf}`).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
})

const THEMED_FILES = [
  'apps/admin/src/app/(admin)/emails/preview/EmailPreviewClient.tsx',
  'apps/admin/src/app/(admin)/emails/[id]/EmailDetailClient.tsx',
  'apps/admin/src/components/ui/Badge.tsx',
  'apps/admin/src/components/ui/StatCard.tsx',
  'apps/admin/src/components/ui/ConfirmModal.tsx',
  'apps/admin/src/app/(admin)/system/SystemClient.tsx',
  'apps/admin/src/app/(admin)/users/[id]/UserDetailClient.tsx',
  'apps/admin/src/app/(admin)/subscriptions/SubscriptionsClient.tsx',
  'apps/admin/src/app/(admin)/sms/SmsClient.tsx',
  'apps/admin/src/app/(admin)/DashboardClient.tsx',
]

describe('admin theming: no hard-coded light palette in themed surfaces', () => {
  for (const f of THEMED_FILES) {
    it(`${path.basename(f)} uses tokens, not Tailwind palette colours`, () => {
      const src = read(f)
      const banned = src.match(/\b(?:bg|text|border|ring|from|to)-(?:white|gray|red|green|emerald|amber|yellow|blue)(?:-\d+)?\b/g) ?? []
      // bg-white allowed only on the switch thumb (a knob, not a surface)
      const offenders = banned.filter((b) => b !== 'bg-white' || !/rounded-full bg-white shadow-sm/.test(src))
      expect(offenders).toEqual([])
    })
  }

  it('email iframes are framed by theme tokens (canvas only), not bg-white wrappers', () => {
    for (const f of THEMED_FILES.slice(0, 2)) {
      const src = read(f)
      expect(src).not.toMatch(/bg-gray-|ring-gray-|text-gray-/)
    }
  })
})
